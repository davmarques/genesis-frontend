import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Bell,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Trophy,
  Calendar,
  MessageSquare,
  Settings,
  Trash2,
  Plus,
  Send,
  Upload,
  Gavel,
  Eye,
  FileText,
  ExternalLink,
  Download,
  Loader2,
  ArrowLeftRight,
  XCircle,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { useRole } from "@/contexts/RoleContext";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: "error" | "success" | "ranking" | "task" | "message" | "dispute";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  priority: "low" | "medium" | "high";
  fromSector?: string;
  toSector?: string;
  unidade?: string;
  fromUnidade?: string;
  errorType?: "alert" | "absence" | "aggravation";
  points?: number;
  status?: "pending" | "accepted" | "disputed" | "approved" | "rejected";
  uploadUrl?: string;
  justificativa?: string;
  nao_no_checklist?: boolean;
  comentario?: string;
}

export default function Notifications() {
  const [activeTab, setActiveTab] = useState("all");
  const [showReportForm, setShowReportForm] = useState(false);
  const [selectedSector, setSelectedSector] = useState("");
  const [selectedUnidade, setSelectedUnidade] = useState("");
  const [errorType, setErrorType] = useState("");
  const [errorDescription, setErrorDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Novos estados para reconhecimento e cadastro de checklist
  const [isRecognizeModalOpen, setIsRecognizeModalOpen] = useState(false);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [isPmoJudgmentModalOpen, setIsPmoJudgmentModalOpen] = useState(false);
  const [pmoComment, setPmoComment] = useState("");
  const [judgmentType, setJudgmentType] = useState<"approved" | "rejected">("approved");
  const [transferSectorId, setTransferSectorId] = useState("");
  const [justification, setJustification] = useState("");
  const [notInChecklist, setNotInChecklist] = useState("false");
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");

  const [dbNotifications, setDbNotifications] = useState<any[]>([]);
  const [sectors, setSectors] = useState<{ id: string | number; nome: string; unidade_id?: number }[]>([]);
  const [unidades, setUnidades] = useState<{ id: string | number; nome: string }[]>([]);
  const { role, rolePermissions, userSector, userSectorId, userUnitId } = useRole();

  const [searchParams, setSearchParams] = useSearchParams();

  // Transformar notificações do banco para o formato da interface UI
  const mappedNotifications: Notification[] = dbNotifications.map(n => {
    const isFinalized = n.status === "accepted";
    const isApproved = n.status === "approved";
    const isRejected = n.status === "rejected";
    const isResolved = isFinalized || isApproved || isRejected;

    // Identificar relação do usuário com a notificação
    const isOrigin = n.setor_ref?.nome?.trim().toLowerCase() === userSector.trim().toLowerCase();
    const isTarget = n.setor?.nome?.trim().toLowerCase() === userSector.trim().toLowerCase();
    
    // Lógica de "Pendência de Ciência": 
    // Se aprovado, é pendente para a origem. Se rejeitado, é pendente para o destino.
    let isRead = isFinalized;
    if (isApproved && !isOrigin) isRead = true; 
    if (isRejected && !isTarget) isRead = true;
    if (n.status === "pending" && !isTarget) isRead = true; // Pendente normal só o alvo vê
    if (n.status === "disputed") isRead = true; // Em disputa ninguém vê como pendente "de ação" até o PMO julgar
    
    // Se a notificação foi transferida e o usuário é o novo destino, marcar como não lida
    if (n.status === "pending" && isTarget) {
      isRead = false;
    }
    
    // Determinar os pontos reais
    let calculatedPoints = 0;
    const isProactiveImprovement = !n.id_setor_ref && n.nao_no_checklist;
    
    // Determinar o "tipo" visual (error = vermelho, success = verde, message = cinza)
    let visualType: Notification["type"] = "error";
    if (n.status === "accepted" || isProactiveImprovement) {
      visualType = "success";
    } else if (n.status === "rejected" || n.status === "disputed") {
      visualType = "message";
    }

    if (isProactiveImprovement) {
      calculatedPoints = 100;
    } else {
      calculatedPoints = (n.notified ? -50 : -100) + (n.nao_no_checklist ? 100 : 0);
    }

    return {
      id: `db-${n.id}`,
      type: visualType,
      title: isProactiveImprovement 
        ? "Melhoria de Processo"
        : isFinalized 
          ? (n.status === "rejected" ? "Notificação Rejeitada" : "Notificação Finalizada")
          : (isApproved ? "Julgamento: Aprovada" : isRejected ? "Julgamento: Recusada" : (n.notified ? "Reincidência" : "Notificação de Erro")),
      description: n.description,
      timestamp: n.created_at,
      read: isRead,
      priority: isRead ? "low" : "high",
      fromSector: n.setor_ref?.nome || "PMO",
      fromUnidade: n.unidade_ref?.nome || "PMO",
      toSector: n.setor?.nome,
      unidade: n.unidade?.nome,
      errorType: isProactiveImprovement ? undefined : (n.notified ? "alert" : "absence"),
      status: n.status || "pending",
      points: calculatedPoints,
      uploadUrl: n.upload_url,
      justificativa: n.justificativa,
      nao_no_checklist: n.nao_no_checklist,
      comentario: n.comentario
    };
  });

  const fetchNotifications = async (currentSectors: any[]) => {
    try {
      let query = supabase
        .from('notificacoes')
        .select(`
          *,
          setor:setor_id(nome),
          unidade:unidade_id(nome),
          setor_ref:id_setor_ref(nome),
          unidade_ref:id_unidade_ref(nome)
        `)
        .order('created_at', { ascending: false });

      if (role !== "pmo") {
        const mySector = currentSectors.find(s => 
          s.nome.trim().toLowerCase() === userSector.trim().toLowerCase()
        );
        
        if (mySector) {
          // Vê o que enviou OU o que recebeu no setor
          query = query.or(`setor_id.eq.${mySector.id},id_setor_ref.eq.${mySector.id}`);
        } else {
          setDbNotifications([]);
          return;
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setDbNotifications(data || []);
    } catch (error) {
      console.error("Erro ao buscar notificações:", error);
    }
  };

  const handleDownload = async (url: string, title: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      
      // Extrair extensão do arquivo original ou usar padrão
      const extension = url.split('.').pop()?.split('?')[0] || 'file';
      link.download = `evidencia-${title.replace(/\s+/g, '-').toLowerCase()}.${extension}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Erro ao baixar arquivo:", error);
      toast.error("Erro ao baixar o arquivo. Tente visualizar e salvar manualmente.");
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      if (id.startsWith('db-')) {
        const dbId = id.replace('db-', '');
        
        // 1. Buscar a notificação para obter a URL do arquivo antes de deletar
        const { data: notification, error: fetchError } = await supabase
          .from('notificacoes')
          .select('upload_url')
          .eq('id', dbId)
          .single();

        if (fetchError) throw fetchError;

        // 2. Deletar do Storage se existir anexo
        if (notification?.upload_url) {
          try {
            // Extrair o caminho relativo do arquivo da URL pública de forma mais robusta
            // A URL do Supabase segue o padrão: .../storage/v1/object/public/evidences/notificacoes/nome-arquivo.ext
            const bucketName = 'evidences';
            const url = notification.upload_url;
            const searchStr = `/${bucketName}/`;
            const startIndex = url.indexOf(searchStr);
            
            if (startIndex !== -1) {
              // Pega tudo após /evidences/ e remove query parameters (?t=...)
              const filePathWithParams = url.substring(startIndex + searchStr.length);
              const filePath = decodeURIComponent(filePathWithParams.split('?')[0]);
              
              const { error: storageError } = await supabase.storage
                .from(bucketName)
                .remove([filePath]);
              
              if (storageError) {
                console.error("Erro detalhado ao remover do storage:", storageError);
              }
            }
          } catch (storageErr) {
            console.error("Erro durante o processamento da exclusão do arquivo:", storageErr);
          }
        }

        // 3. Deletar o registro no banco
        const { error } = await supabase
          .from('notificacoes')
          .delete()
          .eq('id', dbId);

        if (error) throw error;
        toast.success("Notificação e evidências excluídas com sucesso.");
        // Atualizar a lista após deletar
        await fetchNotifications(sectors);
      } else {
        toast.success("Notificação excluída.");
      }
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Não foi possível excluir a notificação.");
    } finally {
      setIdToDelete(null);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sectorsData, unidadesData] = await Promise.all([
          apiFetch("/admin/sectors"),
          apiFetch("/admin/unidades").catch(() => []) // Fallback se não existir ou falhar
        ]);
        const currentSectors = sectorsData || [];
        setSectors(currentSectors);
        setUnidades(unidadesData || []);
        
        await fetchNotifications(currentSectors);
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
        toast.error("Não foi possível carregar os dados necessários.");
      }
    };
    fetchData();
  }, [role, userSector]);

  // Efeito para abrir o modal caso venha um ID na URL - Processa apenas UMA vez por ID
  useEffect(() => {
    const idParam = searchParams.get("id");
    if (idParam && mappedNotifications.length > 0) {
      const targetId = idParam.startsWith('db-') ? idParam : `db-${idParam}`;
      
      // Se já abrimos esta notificação via URL nesta renderização, não fazemos nada
      if (selectedNotification?.id === targetId && isDetailsOpen) {
        return;
      }

      const notification = mappedNotifications.find(n => n.id === targetId);
      if (notification) {
        setSelectedNotification(notification);
        setIsDetailsOpen(true);
        
        // Limpar a URL IMEDIATAMENTE e SILENCIOSAMENTE
        const url = new URL(window.location.href);
        url.searchParams.delete("id");
        window.history.replaceState({}, '', url.pathname + url.search);
        
        // Sincronizar o estado do searchParams do React Router sem disparar novo render agressivo
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, mappedNotifications, isDetailsOpen, selectedNotification]);

  const handleCloseDetails = (open: boolean) => {
    if (!open) {
      setIsDetailsOpen(false);
      setSelectedNotification(null);
      // Forçar limpeza do searchParams se ainda houver
      if (searchParams.get("id")) {
        setSearchParams({}, { replace: true });
      }
    } else {
      setIsDetailsOpen(true);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const dbId = id.replace('db-', '');
      const { error } = await supabase
        .from('notificacoes')
        .update({ status: newStatus })
        .eq('id', dbId);

      if (error) throw error;
      
      const statusLabels: Record<string, string> = {
        accepted: "finalizada",
        disputed: "contestada",
        approved: "aprovada",
        rejected: "rejeitada"
      };

      toast.success(`Notificação ${statusLabels[newStatus] || newStatus} com sucesso!`);
      await fetchNotifications(sectors);
    } catch (error: any) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status: " + error.message);
    }
  };

  const handleConfirmRecognition = async () => {
    if (!selectedNotification) return;
    
    setIsSubmitting(true);
    try {
      const dbId = selectedNotification.id.replace('db-', '');
      const finalJustification = notInChecklist === "true" ? "Atividade não estava no checklist" : justification;
      
      // Tentamos atualizar status e opcionalmente justificativa se a coluna for adicionada no futuro
      const updateData: any = { 
        status: 'accepted',
        justificativa: finalJustification,
        nao_no_checklist: notInChecklist === "true"
      };
      
      const { error } = await supabase
        .from('notificacoes')
        .update(updateData)
        .eq('id', dbId);

      if (error) throw error;

      toast.success("Notificação reconhecida com sucesso!");
      
      // Se marcou que não estava no checklist, abre o modal de cadastro
      if (notInChecklist === "true") {
        setNewChecklistTitle(selectedNotification.description || selectedNotification.title); 
        setIsChecklistModalOpen(true);
      }

      setIsRecognizeModalOpen(false);
      setJustification("");
      setNotInChecklist("false");
      await fetchNotifications(sectors);
    } catch (error: any) {
      console.error("Erro ao reconhecer:", error);
      toast.error("Erro ao processar reconhecimento.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDispute = async () => {
    if (!selectedNotification) return;
    if (!justification.trim()) {
      toast.error("Por favor, forneça uma justificativa para a contestação.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const dbId = selectedNotification.id.replace('db-', '');
      
      const { error } = await supabase
        .from('notificacoes')
        .update({ 
          status: 'disputed',
          justificativa: justification 
        })
        .eq('id', dbId);

      if (error) throw error;

      toast.success("Notificação contestada! O PMO analisará sua justificativa.");
      setIsDisputeModalOpen(false);
      setJustification("");
      await fetchNotifications(sectors);
    } catch (error: any) {
      console.error("Erro ao contestar:", error);
      toast.error("Erro ao processar contestação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePmoJudgment = async () => {
    if (!selectedNotification) return;
    if (!pmoComment.trim()) {
      toast.error("Por favor, forneça um comentário para o julgamento.");
      return;
    }

    setIsSubmitting(true);
    try {
      const dbId = selectedNotification.id.replace('db-', '');
      
      const updateData: any = { 
        status: judgmentType,
        comentario: pmoComment 
      };

      // Se a contestação for aprovada (judgmentType === 'approved'), o PMO concorda que o setor atual não é o responsável.
      // Nesse caso, se houver um setor de transferência selecionado, trocamos o setor e voltamos para 'pending'.
      if (judgmentType === 'approved' && transferSectorId && transferSectorId !== "none") {
        updateData.setor_id = parseInt(transferSectorId);
        // Ao transferir, a notificação volta a ser pendente para o novo setor
        updateData.status = 'pending'; 
      }

      const { error } = await supabase
        .from('notificacoes')
        .update(updateData)
        .eq('id', dbId);

      if (error) throw error;

      if (judgmentType === 'approved' && transferSectorId && transferSectorId !== "none") {
        toast.success(`Notificação transferida para o novo setor com sucesso!`);
      } else {
        toast.success(`Disputa ${judgmentType === 'approved' ? 'aprovada' : 'recusada'} com sucesso!`);
      }
      
      setIsPmoJudgmentModalOpen(false);
      setPmoComment("");
      setTransferSectorId("");
      await fetchNotifications(sectors);
    } catch (error: any) {
      console.error("Erro no julgamento PMO:", error);
      toast.error("Erro ao processar julgamento.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterChecklist = async () => {
    if (!newChecklistTitle.trim()) {
      toast.error("Por favor, digite o título da atividade.");
      return;
    }

    if (!userSectorId) {
      toast.error("Erro: Setor do usuário não identificado.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('checklist')
        .insert({
          titulo: newChecklistTitle,
          setor_id: Number(userSectorId),
          unidade_id: Number(userUnitId) || null,
          pdf_url: ""
        });

      if (error) throw error;

      toast.success("Atividade cadastrada no checklist com sucesso!");
      setIsChecklistModalOpen(false);
      setNewChecklistTitle("");
    } catch (error: any) {
      console.error("Erro ao cadastrar checklist:", error);
      toast.error("Erro ao cadastrar atividade.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const allNotifications = mappedNotifications;

  // Filtrar setores para o formulário de notificação
  const filteredSectors = role === "pmo"
    ? (selectedUnidade ? sectors.filter(s => String(s.unidade_id) === selectedUnidade) : sectors)
    : (() => {
        const mySector = sectors.find(s => 
          s.nome.trim().toLowerCase() === userSector.trim().toLowerCase()
        );
        return mySector && mySector.unidade_id 
          ? sectors.filter(s => s.unidade_id === mySector.unidade_id)
          : sectors;
      })();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
      
      if (!allowedTypes.includes(file.type)) {
        toast.error("Formato de arquivo não suportado. Use PDF, JPG ou PNG.");
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error("O arquivo é muito grande. O limite é 5MB.");
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleSendNotification = async () => {
    if (!selectedSector) {
      toast.error("Por favor, selecione o setor.");
      return;
    }
    if (role === "pmo" && !selectedUnidade) {
      toast.error("Por favor, selecione a unidade.");
      return;
    }
    if (!errorType) {
      toast.error("Por favor, informe se já foi notificado anteriormente.");
      return;
    }
    if (!errorDescription) {
      toast.error("Por favor, descreva o erro.");
      return;
    }

    setIsSubmitting(true);
    try {
      let finalUnidadeId = selectedUnidade;
      let uploadUrl = null;

      // Buscar info do criador de forma robusta
      const creatorSector = sectors.find(s => 
        s.nome.trim().toLowerCase() === userSector.trim().toLowerCase()
      );

      // Se não for PMO, buscar unidade do setor do usuário (caso não tenha vindo do form)
      if (role !== "pmo" && !finalUnidadeId) {
        if (creatorSector && creatorSector.unidade_id) {
          finalUnidadeId = String(creatorSector.unidade_id);
        }
      }

      // IDs de referência (quem criou)
      const creatorSectorId = creatorSector?.id ? parseInt(String(creatorSector.id)) : null;
      const creatorUnidadeId = creatorSector?.unidade_id ? parseInt(String(creatorSector.unidade_id)) : null;

      // Upload de arquivo se houver um selecionado
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `notificacoes/${fileName}`;

        const { error: uploadError, data } = await supabase.storage
          .from('evidences')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;
        
        // Buscar URL pública
        const { data: { publicUrl } } = supabase.storage
          .from('evidences')
          .getPublicUrl(filePath);
          
        uploadUrl = publicUrl;
      }

      const { error } = await supabase
        .from('notificacoes')
        .insert([
          {
            setor_id: parseInt(selectedSector),
            unidade_id: finalUnidadeId ? parseInt(finalUnidadeId) : null,
            notified: errorType === "alert", // Sim -> true, Não -> false
            description: errorDescription,
            upload_url: uploadUrl,
            status: 'pending',
            created_at: new Date().toISOString(), // Enviar explicitamente em UTC
            id_setor_ref: creatorSectorId,
            id_unidade_ref: creatorUnidadeId
          }
        ]);

      if (error) throw error;

      toast.success("Notificação enviada com sucesso! +50 pontos para seu setor.");
      setShowReportForm(false);
      // Atualizar lista
      fetchNotifications(sectors);
      // Limpar form
      setSelectedSector("");
      setSelectedUnidade("");
      setErrorType("");
      setErrorDescription("");
      setSelectedFile(null);
    } catch (error: any) {
      console.error("Erro ao enviar notificação:", error);
      toast.error("Erro ao enviar notificação: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSubtitle = () => {
    switch (role) {
      case "pmo": return "Todas as notificações e disputas pendentes";
      case "manager": return "Notificações do setor e erros reportados";
      case "collaborator": return "Suas notificações e tarefas";
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "error":
        return <AlertCircle className="w-5 h-5 text-destructive" />;
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-success" />;
      case "ranking":
        return <Trophy className="w-5 h-5 text-gold" />;
      case "task":
        return <Calendar className="w-5 h-5 text-primary" />;
      case "message":
        return <MessageSquare className="w-5 h-5 text-secondary" />;
      case "dispute":
        return <Gavel className="w-5 h-5 text-warning" />;
      default:
        return <Bell className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getNotificationBadge = (type: string) => {
    if (type === "error") return null;
    const variants = {
      error: "bg-destructive/10 text-destructive border-destructive/30",
      success: "bg-success/10 text-success border-success/30",
      ranking: "bg-gold/10 text-gold border-gold/30",
      task: "bg-primary/10 text-primary border-primary/30",
      message: "bg-secondary/10 text-secondary border-secondary/30",
      dispute: "bg-warning/10 text-warning border-warning/30"
    };
    const labels = {
      error: "Erro",
      success: "Sucesso",
      ranking: "Ranking",
      task: "Tarefa",
      message: "Mensagem",
      dispute: "Disputa"
    };
    return (
      <Badge variant="outline" className={variants[type as keyof typeof variants]}>
        {labels[type as keyof typeof labels]}
      </Badge>
    );
  };

  const getErrorTypeBadge = (errorType: string) => {
    const variants = {
      alert: { class: "bg-warning/10 text-warning border-warning/30", label: "Alerta" },
      absence: { class: "bg-destructive/10 text-destructive border-destructive/30", label: "Ausência" },
      aggravation: { class: "bg-destructive/20 text-destructive border-destructive/50", label: "Agravamento" }
    };
    const variant = variants[errorType as keyof typeof variants];
    return variant ? (
      <Badge variant="outline" className={variant.class}>
        {variant.label}
      </Badge>
    ) : null;
  };

  const formatTimestamp = (timestamp: string) => {
    // Garantir que a data do banco seja tratada como UTC ao criar o objeto Date
    // já que o Postgres "timestamp without time zone" pode vir sem o sufixo Z
    const isoString = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T');
    const date = new Date(isoString.endsWith('Z') || isoString.includes('+') ? isoString : `${isoString}Z`);
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'agora mesmo';
    } else if (diffMins < 60) {
      return `há ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
    } else if (diffHours < 24) {
      return `há ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    } else if (diffDays < 7) {
      return `há ${diffDays} dia${diffDays !== 1 ? 's' : ''}`;
    } else {
      return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    }
  };

  const unreadCount = allNotifications.filter(n => n.status === "pending").length;
  // Para todos os perfis, disputeCount foca em status "disputed"
  const disputeCount = allNotifications.filter(n => n.status === "disputed").length;

  return (
    <AppLayout title="Notificações" subtitle={getSubtitle()}>
      <div className="p-6 space-y-6">

        {/* Stats */}
        <div className={`grid grid-cols-1 ${role === "pmo" ? "md:grid-cols-3" : "md:grid-cols-4"} gap-4`}>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-foreground">{allNotifications.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em aberto</p>
                <p className="text-2xl font-bold text-foreground">{unreadCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Gavel className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Disputas</p>
                <p className="text-2xl font-bold text-foreground">{disputeCount}</p>
              </div>
            </div>
          </Card>
          {role !== "pmo" && (
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gold/10">
                  <Trophy className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ranking</p>
                  <p className="text-2xl font-bold text-foreground">
                    {allNotifications.filter(n => n.type === "ranking").length}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>

          <div className="flex flex-row pb-2 justify-between">
            <TabsList>
              <TabsTrigger value="all">Todas ({allNotifications.length})</TabsTrigger>
              <TabsTrigger value="unread">Em aberto ({unreadCount})</TabsTrigger>
              {(role === "pmo" || role === "manager") && (
                <TabsTrigger value="disputes">
                  Disputas ({disputeCount})
                </TabsTrigger>
              )}
            </TabsList>

            {rolePermissions.canReportErrors && (
              <Button
                className="gap-2 bg-destructive hover:bg-destructive/90"
                onClick={() => setShowReportForm(!showReportForm)}
              >
                <AlertCircle className="w-4 h-4" />
                Reportar Erro
              </Button>
            )}
          </div>

          {/* Report Error Form */}
          {showReportForm && (
            <Card className="p-6 border-destructive/30 bg-destructive/5">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                Reportar Erro em Outro Setor
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Ao reportar um erro, seu setor ganha +50 pontos de auditoria. O setor notificado pode reconhecer a falha ou contestar (disputa será julgada pelo PMO).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {role === "pmo" && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Unidade</label>
                    <Select value={selectedUnidade} onValueChange={(value) => {
                      setSelectedUnidade(value);
                      setSelectedSector(""); // Resetar setor ao mudar unidade
                    }}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione a unidade..." />
                      </SelectTrigger>
                      <SelectContent>
                        {unidades.map((unidade) => (
                          <SelectItem key={unidade.id} value={String(unidade.id)}>
                            {unidade.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-2 block">Setor Notificado</label>
                  <Select value={selectedSector} onValueChange={setSelectedSector}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o setor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSectors.map((sector) => (
                        <SelectItem key={sector.id} value={String(sector.id)}>
                          {sector.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mb-6">
                <label className="text-sm font-medium mb-3 block">Já notificou este setor pelo mesmo motivo?</label>
                <RadioGroup
                  value={errorType}
                  onValueChange={setErrorType}
                  className="flex flex-row gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="alert" id="alert" />
                    <Label htmlFor="alert" className="font-normal cursor-pointer">Sim</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="absence" id="absence" />
                    <Label htmlFor="absence" className="font-normal cursor-pointer">Não</Label>
                  </div>

                </RadioGroup>
              </div>
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Descrição do Erro</label>
                <Textarea
                  placeholder="Descreva detalhadamente o erro encontrado..."
                  value={errorDescription}
                  onChange={(e) => setErrorDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Evidência (opcional)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                  />
                  <Button 
                    variant="outline" 
                    className={`gap-2 ${selectedFile ? 'border-primary text-primary bg-primary/5' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                    disabled={isSubmitting}
                  >
                    <Upload className="w-4 h-4" />
                    {selectedFile ? 'Trocar Arquivo' : 'Anexar Arquivo'}
                  </Button>
                  {selectedFile && (
                    <div className="flex items-center gap-2 text-sm text-foreground bg-secondary/50 px-3 py-1.5 rounded-md">
                      <span className="max-w-[200px] truncate">{selectedFile.name}</span>
                      <button 
                        onClick={() => setSelectedFile(null)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Formatos aceitos: PDF, JPG, PNG (máx. 5MB)
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowReportForm(false)} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button 
                  className="gap-2 bg-destructive hover:bg-destructive/90"
                  onClick={handleSendNotification}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {isSubmitting ? "Enviando..." : "Enviar Notificação"}
                </Button>
              </div>
            </Card>
          )}

          <TabsContent value={activeTab} className="mt-6">
            <div className="space-y-3">
              {role === "pmo" ? (
                <Accordion type="multiple" className="space-y-4">
                  {sectors
                    .filter(sector => 
                      allNotifications.some(n => 
                        n.toSector === sector.nome && (
                          activeTab === "all" || 
                          (activeTab === "unread" && n.status === "pending") ||
                          (activeTab === "disputes" && n.status === "disputed")
                        )
                      )
                    )
                    .map(sector => {
                      const sectorNotifications = allNotifications.filter(n => 
                        n.toSector === sector.nome && (
                          activeTab === "all" || 
                          (activeTab === "unread" && n.status === "pending") ||
                          (activeTab === "disputes" && n.status === "disputed")
                        )
                      );

                      return (
                        <AccordionItem key={sector.id} value={String(sector.id)} className="border rounded-lg px-4 bg-card">
                          <AccordionTrigger className="hover:no-underline py-4">
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-lg">{sector.nome}</span>
                              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                                {sectorNotifications.length} {sectorNotifications.length === 1 ? 'Notificação' : 'Notificações'}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4 space-y-3">
                            {sectorNotifications.map((notification) => (
                              <Card
                                key={notification.id}
                                className={`p-5 hover:border-primary/50 transition-all ${!notification.read ? 'border-primary/30 bg-primary/5' : ''
                                  }`}
                              >
                                <div className="flex items-start gap-4">
                                  <div className={`p-3 rounded-lg ${notification.type === "error" ? "bg-destructive/10" :
                                    notification.type === "success" ? "bg-success/10" :
                                      notification.type === "ranking" ? "bg-gold/10" :
                                        notification.type === "task" ? "bg-primary/10" :
                                          notification.type === "dispute" ? "bg-warning/10" :
                                            "bg-secondary/10"
                                    }`}>
                                    {getNotificationIcon(notification.type)}
                                  </div>

                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <h3 className="font-semibold text-foreground">
                                            {notification.title}
                                          </h3>
                                          {!notification.read && (
                                            <div className="w-2 h-2 rounded-full bg-primary" />
                                          )}
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-2">
                                          {notification.description}
                                        </p>
                                        <div className="flex items-center gap-3">
                                          {notification.points !== undefined && (
                                            <Badge className={notification.points > 0 ? "bg-success/10 text-success border-success/30" : "bg-destructive/10 text-destructive border-destructive/30"}>
                                              {notification.points > 0 ? `+${notification.points}` : notification.points} pts
                                            </Badge>
                                          )}
                                          {notification.status && (
                                            <Badge variant="outline" className={
                                              notification.status === "pending" ? "bg-warning/10 text-warning border-warning/30" :
                                                notification.status === "disputed" ? "bg-destructive/10 text-destructive border-destructive/30" :
                                                  notification.status === "rejected" ? "bg-muted text-muted-foreground border-muted" :
                                                    "bg-success/10 text-success border-success/30"
                                            }>
                                              {notification.status === "pending" ? "Pendente" :
                                                notification.status === "disputed" ? "Em Disputa" :
                                                  notification.status === "rejected" ? "Rejeitada" : "Finalizada"}
                                            </Badge>
                                          )}
                                          <span className="text-xs text-muted-foreground">
                                            {formatTimestamp(notification.timestamp)}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {notification.status === "disputed" && role === "pmo" && (
                                          <div className="flex gap-2">
                                            <Button 
                                              size="sm" 
                                              className="bg-success hover:bg-success/90 text-success-foreground gap-1"
                                              onClick={() => {
                                                setSelectedNotification(notification);
                                                setJudgmentType("approved");
                                                setIsPmoJudgmentModalOpen(true);
                                              }}
                                            >
                                              <CheckCircle2 className="w-4 h-4" />
                                              Aprovar Contestação
                                            </Button>
                                            <Button 
                                              size="sm" 
                                              variant="destructive" 
                                              className="gap-1"
                                              onClick={() => {
                                                setSelectedNotification(notification);
                                                setJudgmentType("rejected");
                                                setIsPmoJudgmentModalOpen(true);
                                              }}
                                            >
                                              <XCircle className="w-4 h-4" />
                                              Manter Falha
                                            </Button>
                                          </div>
                                        )}
                                        <Button 
                                          variant="ghost" 
                                          size="icon"
                                          onClick={() => {
                                            setSelectedNotification(notification);
                                            setIsDetailsOpen(true);
                                          }}
                                        >
                                          <Eye className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                </Accordion>
              ) : (
                allNotifications
                  .filter(n => {
                    if (activeTab === "unread") {
                      return n.status === "pending";
                    }
                    if (activeTab === "disputes") {
                      return n.status === "disputed";
                    }
                    return true;
                  })
                  .map((notification) => (
                    <Card
                      key={notification.id}
                      className={`p-5 hover:border-primary/50 transition-all ${!notification.read ? 'border-primary/30 bg-primary/5' : ''
                        }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg ${notification.type === "error" ? "bg-destructive/10" :
                          notification.type === "success" ? "bg-success/10" :
                            notification.type === "ranking" ? "bg-gold/10" :
                              notification.type === "task" ? "bg-primary/10" :
                                notification.type === "dispute" ? "bg-warning/10" :
                                  "bg-secondary/10"
                          }`}>
                          {getNotificationIcon(notification.type)}
                        </div>

                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-foreground">
                                  {notification.title}
                                </h3>
                                {!notification.read && (
                                  <div className="w-2 h-2 rounded-full bg-primary" />
                                )}
                              </div>
                              
                              {role !== "pmo" && (
                                <div className="flex items-center gap-1.5 mb-2">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Origem:</span>
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-muted/30 border-muted-foreground/20 font-medium">
                                    {notification.fromSector || "PMO"}
                                  </Badge>
                                </div>
                              )}

                              <p className="text-sm text-muted-foreground mb-2">
                                {notification.description}
                              </p>
                              <div className="flex items-center gap-3">
                                {notification.points !== undefined && (
                                  <Badge className={notification.points > 0 ? "bg-success/10 text-success border-success/30" : "bg-destructive/10 text-destructive border-destructive/30"}>
                                    {notification.points > 0 ? `+${notification.points}` : notification.points} pts
                                  </Badge>
                                )}
                                {notification.status && (
                                  <Badge variant="outline" className={
                                    notification.status === "pending" ? "bg-warning/10 text-warning border-warning/30" :
                                      notification.status === "disputed" ? "bg-destructive/10 text-destructive border-destructive/30" :
                                        notification.status === "rejected" ? "bg-muted text-muted-foreground border-muted" :
                                          "bg-success/10 text-success border-success/30"
                                  }>
                                    {notification.status === "pending" ? "Pendente" :
                                      notification.status === "disputed" ? "Em Disputa" :
                                        notification.status === "rejected" ? "Rejeitada" : "Finalizada"}
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {formatTimestamp(notification.timestamp)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {notification.status === "pending" && 
                               notification.toSector?.trim().toLowerCase() === userSector.trim().toLowerCase() && (
                                <>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="text-success border-success/30 hover:bg-success/10"
                                    onClick={() => {
                                      setSelectedNotification(notification);
                                      setIsRecognizeModalOpen(true);
                                    }}
                                  >
                                    Reconhecer
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                    onClick={() => {
                                      setSelectedNotification(notification);
                                      setIsDisputeModalOpen(true);
                                    }}
                                  >
                                    Contestar
                                  </Button>
                                </>
                              )}
                              {/* Botão de ciência após julgamento (Marcar como Lida) */}
                              {((notification.status === "approved" && notification.fromSector?.trim().toLowerCase() === userSector.trim().toLowerCase()) ||
                                (notification.status === "rejected" && notification.toSector?.trim().toLowerCase() === userSector.trim().toLowerCase())) && (
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                                    onClick={() => handleUpdateStatus(notification.id, "accepted")}
                                  >
                                    Marcar como Lida
                                  </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => {
                                  setSelectedNotification(notification);
                                  setIsDetailsOpen(true);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => {
                                  setIdToDelete(notification.id);
                                  setIsDeleteDialogOpen(true);
                                }}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Notification Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={handleCloseDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedNotification && getNotificationIcon(selectedNotification.type)}
                {selectedNotification?.title}
              </DialogTitle>
              <DialogDescription>
                Detalhes completos da notificação enviada
              </DialogDescription>
            </DialogHeader>

            {selectedNotification && (
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Origem</p>
                    <div className="flex flex-col p-2 rounded-md bg-muted/50 border border-muted">
                      <span className="text-xs text-muted-foreground">{selectedNotification.fromUnidade || "Não informada"}</span>
                      <span className="font-semibold text-sm">{selectedNotification.fromSector || "Não informado"}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-primary/80 uppercase tracking-wider">Destino</p>
                    <div className="flex flex-col p-2 rounded-md bg-primary/5 border border-primary/20">
                      <span className="text-xs text-primary/70">{selectedNotification.unidade || "Não informada"}</span>
                      <span className="font-semibold text-sm text-primary">{selectedNotification.toSector || "Não informado"}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Data/Hora</p>
                    <p className="font-semibold text-sm">
                      {(() => {
                        const isoString = selectedNotification.timestamp.includes('T') 
                          ? selectedNotification.timestamp 
                          : selectedNotification.timestamp.replace(' ', 'T');
                        const dateObj = new Date(isoString.endsWith('Z') || isoString.includes('+') ? isoString : `${isoString}Z`);
                        return dateObj.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
                      })()}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Tipo de Ocorrência</p>
                  <div className="flex gap-2">
                    {getNotificationBadge(selectedNotification.type)}
                    {selectedNotification.errorType && getErrorTypeBadge(selectedNotification.errorType)}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Descrição</p>
                  <Card className="p-4 bg-muted/30 border-none">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedNotification.description}
                    </p>
                  </Card>
                </div>

                {selectedNotification.uploadUrl && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Anexo / Evidência
                    </p>
                    <Card className="p-4 flex items-center justify-between border-dashed">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          {selectedNotification.uploadUrl.toLowerCase().endsWith('.pdf') ? (
                            <FileText className="w-5 h-5 text-primary" />
                          ) : (
                            <Upload className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">Arquivo de Evidência</p>
                          <p className="text-xs text-muted-foreground">Original carregado pelo usuário</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2"
                          asChild
                        >
                          <a href={selectedNotification.uploadUrl} target="_blank" rel="noopener noreferrer">
                            <Eye className="w-4 h-4" />
                            Visualizar
                          </a>
                        </Button>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="gap-2"
                          onClick={() => handleDownload(selectedNotification.uploadUrl!, selectedNotification.title)}
                        >
                          <Download className="w-4 h-4" />
                          Baixar
                        </Button>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tem certeza que deseja excluir?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. A notificação e todos os seus anexos (evidências) serão removidos permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIdToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => idToDelete && handleDeleteNotification(idToDelete)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir Permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Recognize Notification Dialog */}
        <Dialog open={isRecognizeModalOpen} onOpenChange={setIsRecognizeModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reconhecer Notificação</DialogTitle>
              <DialogDescription>
                Forneça uma justificativa para o reconhecimento desta falha.
              </DialogDescription>
              <div className="space-y-3">
                <Label>Esta atividade estava prevista no seu checklist?</Label>
                <RadioGroup 
                  value={notInChecklist} 
                  onValueChange={setNotInChecklist}
                  className="flex flex-col space-y-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="false" id="in-checklist" />
                    <Label htmlFor="in-checklist" className="font-normal">Sim, estava no checklist</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="true" id="not-in-checklist" />
                    <Label htmlFor="not-in-checklist" className="font-normal text-destructive font-medium">Não estava no checklist (Cadastrar agora)</Label>
                  </div>
                </RadioGroup>
              </div>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="justification">Justificativa</Label>
                <Textarea
                  id="justification"
                  placeholder={notInChecklist === "true" ? "Atividade fora do checklist (Justificativa automática)" : "Descreva o motivo do reconhecimento..."}
                  value={notInChecklist === "true" ? "" : justification}
                  onChange={(e) => setJustification(e.target.value)}
                  disabled={notInChecklist === "true"}
                  className="min-h-[100px] disabled:opacity-50 disabled:bg-muted"
                />
              </div>
              
              
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsRecognizeModalOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirmRecognition} 
                disabled={isSubmitting || (notInChecklist === "false" && !justification.trim())}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirmar Reconhecimento
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dispute Notification Dialog */}
        <Dialog open={isDisputeModalOpen} onOpenChange={setIsDisputeModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-destructive" />
                Contestar Notificação
              </DialogTitle>
              <DialogDescription>
                Explique por que seu setor não reconhece esta falha. O PMO avaliará sua defesa.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="dispute-justification">Sua Justificativa / Defesa</Label>
                <Textarea
                  id="dispute-justification"
                  placeholder="Explique os detalhes do porquê esta notificação é indevida..."
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => {
                setIsDisputeModalOpen(false);
                setJustification("");
              }}>
                Cancelar
              </Button>
              <Button 
                variant="destructive"
                onClick={handleConfirmDispute} 
                disabled={isSubmitting || !justification.trim()}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Enviar Contestação
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* PMO Judgment Dialog */}
        <Dialog open={isPmoJudgmentModalOpen} onOpenChange={setIsPmoJudgmentModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Julgamento de Contestação
              </DialogTitle>
              <DialogDescription>
                Você está prestes a {judgmentType === "approved" ? "APROVAR" : "RECUSAR"} esta contestação.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-3 rounded-md bg-muted/50 border border-muted">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Justificativa do Setor:
                </p>
                <p className="text-xs italic">
                  "{selectedNotification?.justificativa || "Sem justificativa"}"
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pmo-comment">Seu Comentário / Parecer Final</Label>
                <Textarea
                  id="pmo-comment"
                  placeholder="Explique o motivo da sua decisão..."
                  value={pmoComment}
                  onChange={(e) => setPmoComment(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              {judgmentType === "approved" && (
                <div className="space-y-2 p-3 border border-warning/30 bg-warning/5 rounded-md">
                  <Label className="text-warning flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4" />
                    Deseja transferir para outro setor? (Opcional)
                  </Label>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Caso o setor que contestou esteja correto e a falha seja de outro setor, selecione abaixo.
                  </p>
                  <Select value={transferSectorId} onValueChange={setTransferSectorId}>
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="Manter setor atual" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Manter setor atual</SelectItem>
                      {sectors
                        .filter(s => s.id.toString() !== selectedNotification?.toSector)
                        .map((sector) => (
                          <SelectItem key={sector.id} value={String(sector.id)}>
                            {sector.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => {
                setIsPmoJudgmentModalOpen(false);
                setPmoComment("");
              }}>
                Cancelar
              </Button>
              <Button 
                className={judgmentType === "approved" ? "bg-success text-success-foreground hover:bg-success/90" : ""}
                variant={judgmentType === "approved" ? "default" : "destructive"}
                onClick={handlePmoJudgment} 
                disabled={isSubmitting || !pmoComment.trim()}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirmar {judgmentType === "approved" ? "Aprovação" : "Recusa"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Register New Checklist Item Dialog */}
        <Dialog open={isChecklistModalOpen} onOpenChange={setIsChecklistModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cadastrar Nova Atividade</DialogTitle>
              <DialogDescription>
                Como esta falha não estava no seu checklist, cadastre-a agora para evitar reincidência.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-checklist-title">Título da Atividade</Label>
                <Input
                  id="new-checklist-title"
                  placeholder="Ex: Conferência de validade de insumos..."
                  value={newChecklistTitle}
                  onChange={(e) => setNewChecklistTitle(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsChecklistModalOpen(false)}>
                Depois
              </Button>
              <Button 
                onClick={handleRegisterChecklist} 
                disabled={isSubmitting || !newChecklistTitle.trim()}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Cadastrar no Checklist
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
