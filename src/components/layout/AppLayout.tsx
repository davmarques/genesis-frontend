import logo from "../../assets/images/genesis-logo.png";
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  Trophy,
  Users,
  Bell,
  FileText,
  Shield,
  LogOut,
  Menu,
  X,
  TrendingUp,
  ChevronDown
} from "lucide-react";
import { useRole, UserRole } from "@/contexts/RoleContext";
import { supabase } from "@/lib/supabase";

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [disputeCount, setDisputeCount] = useState(0);
  const { role, userName, userSector, userUnitId, userSectorId } = useRole();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDisputeCount = async () => {
      try {
        console.log("Fetching dispute count...");
        let query = supabase.from('notificacoes').select('status, unidade_id, setor_id');
        
        // Se não for PMO, filtramos por unidade ou setor
        if (role !== 'pmo') {
          if (userUnitId) {
            query = query.eq('unidade_id', userUnitId);
          } else if (userSectorId) {
            query = query.eq('setor_id', userSectorId);
          }
        }

        const { data, error } = await query;
        
        if (error) {
          console.error("Supabase error fetching notifications:", error);
          return;
        }

        if (!data) return;

        const pendingStatus = ['disputed', 'contestada', 'pending', 'pendente'];
        const count = data.filter(n => {
          const s = n.status?.toLowerCase().trim();
          return !s || pendingStatus.includes(s);
        }).length;

        console.log("Dispute count fetched:", count);
        setDisputeCount(count);
      } catch (err) {
        console.error("Error in fetchDisputeCount:", err);
      }
    };

    fetchDisputeCount();

    // Inscrição em tempo real
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notificacoes'
        },
        () => {
          console.log("Notificacoes changed, refetching...");
          fetchDisputeCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, userUnitId, userSectorId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("genesis_token");
    localStorage.removeItem("genesis_user");
    navigate("/auth");
  };

  const navItems = [
    { path: "/dashboard", icon: Trophy, label: "Dashboard" },
    { path: "/checklists", icon: FileText, label: "Checklists" },
    { path: "/teams", icon: Users, label: "Equipes", hideFor: ["collaborator"] },
    { path: "/notifications", icon: Bell, label: "Notificações", badge: disputeCount },
    { path: "/reports", icon: TrendingUp, label: "Relatórios", hideFor: ["collaborator"] },
  ];

  const filteredNavItems = navItems.filter(
    item => !item.hideFor?.includes(role)
  );

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 border-r border-border bg-card flex flex-col overflow-hidden`}>
        <div className="p-8 pb-0  border-border">
          <div className="flex items-center gap-2 mb-4">
            <img src={logo} className="" alt="Gênesis Logo" />
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {filteredNavItems.map(item => {
            const isActive = location.pathname === item.path;
            const hasBadge = item.badge !== undefined && item.badge > 0;
            return (
              <Button
                key={item.path}
                variant="ghost"
                className={`w-full justify-start gap-3 h-11 ${isActive
                  ? 'bg-primary/10 text-primary hover:bg-primary/20 font-semibold'
                  : 'hover:bg-muted'
                  }`}
                asChild
              >
                <Link to={item.path}>
                  <item.icon className="w-5 h-5" />
                  {item.label}
                  {hasBadge && (
                    <Badge className="ml-auto bg-destructive text-destructive-foreground text-xs animate-pulse">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              </Button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-muted/50 border border-border/50">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-semibold shadow-md shrink-0">
              {getInitials(userName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{userName || "Usuário"}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium truncate">{userSector || "Setor Geral"}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm p-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-semibold shadow-md">
              {getInitials(userName)}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
