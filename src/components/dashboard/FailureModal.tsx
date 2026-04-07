import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/contexts/RoleContext";

interface FailureModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  type: "servico" | "convenio";
  itemId: number | null;
  itemName: string;
}

export function FailureModal({ 
  isOpen, 
  onOpenChange, 
  type, 
  itemId, 
  itemName 
}: FailureModalProps) {
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { userSectorId, userUnitId } = useRole();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !itemId) {
      toast({
        variant: "destructive",
        title: "Campo obrigatório",
        description: "Por favor, descreva a falha encontrada.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Inserir o relatório na tabela correspondente (report ou report_convenio)
      const targetTable = type === "servico" ? "report" : "report_convenio";
      const idColumn = type === "servico" ? "servico_id" : "servico_convenio_id";
      
      const { error: insertError } = await supabase
        .from(targetTable)
        .insert({
          [idColumn]: itemId,
          report: description,
          status: "Pendente"
        });

      if (insertError) throw insertError;

      // 2. Opcional: Manter o registro na tabela de notificações para histórico/alerta
      const { error: notifError } = await supabase.from("notificacoes").insert({
        setor_id: userSectorId,
        unidade_id: userUnitId,
        description: `Falha de Checklist Reportada: ${type === "servico" ? "Serviço" : "Convênio"} "${itemName}". Motivo: ${description}`,
        status: "pending",
        nao_no_checklist: true,
        created_at: new Date().toISOString(),
      });

      if (notifError) throw notifError;

      toast({
        title: "Relatório de Falha Enviado",
        description: "A falha foi registrada no item e enviada para análise.",
      });
      
      setDescription("");
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao registrar",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-destructive/10 p-2 rounded-full">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <DialogTitle>Identificar Falha</DialogTitle>
          </div>
          <DialogDescription>
            Descreva a falha encontrada no {type === "servico" ? "serviço" : "convênio"} <strong>{itemName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="description">Descrição da Falha</Label>
            <Textarea
              id="description"
              placeholder="Descreva detalhadamente o que ocorreu..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[120px]"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Registrar Falha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
