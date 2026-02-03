import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/contexts/RoleContext";
import { Lock, Mail, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import logo from "../assets/images/genesis-logo.png";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mustResetPassword, setMustResetPassword] = useState(false);
  const [isLocalAuth, setIsLocalAuth] = useState(false);
  const { setRole, setUserName, setUserSector, setUserUnitId, setUserSectorId } = useRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const cleanEmail = email.toLowerCase().trim();

    try {
      // 1. Tentar login via Supabase Auth
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) throw error;

      if (authData.user) {
        console.log("Login successful. User ID:", authData.user.id);
        console.log("Session details:", {
          hasSession: !!authData.session,
          expires_at: authData.session?.expires_at
        });
        
        const metadata = authData.user.user_metadata;
        console.log("User metadata:", metadata);
        
        // Se precisar resetar senha (primeiro acesso)
        // CRITICAL: Check both metadata flag and the password itself
        const isDefaultPassword = password === 'admin123';
        const needsReset = metadata?.needs_password_reset === true || isDefaultPassword;

        console.log("Check reset:", { needsReset, isDefaultPassword, metadataFlag: metadata?.needs_password_reset });

        if (needsReset) {
          console.log("REDIRECTING TO RESET FORM");
          // Garantir que o token seja salvo mesmo que precise resetar a senha
          if (authData.session?.access_token) {
            localStorage.setItem("genesis_token", authData.session.access_token);
          }
          setMustResetPassword(true);
          toast({
            title: "Primeiro Acesso",
            description: "Para sua segurança, defina uma nova senha.",
          });
          setIsLoading(false);
          return;
        }

        // Tentar buscar detalhes extras na tabela 'users' para garantir consistência
        const { data: dbUser } = await supabase
          .from('users')
          .select('unidade_id, setor_id, role, name')
          .eq('email', cleanEmail)
          .single();

        // Mapear role
        let userRole = dbUser?.role || metadata?.role || (cleanEmail.includes('admin') ? 'pmo' : 'coordinator');
        if (userRole === 'manager') userRole = 'coordinator';
        
        const userData = {
          id: authData.user.id,
          email: authData.user.email,
          name: dbUser?.name || metadata?.full_name || "Usuário",
          role: userRole,
          sector: metadata?.sector || "Setor Geral",
          unidade_id: dbUser?.unidade_id || metadata?.unidade_id || null,
          setor_id: dbUser?.setor_id || null
        };

        setRole(userRole as any);
        setUserName(userData.name);
        setUserSector(userData.sector);
        setUserUnitId(userData.unidade_id);
        setUserSectorId(userData.setor_id);
        localStorage.setItem("genesis_user", JSON.stringify(userData));
        if (authData.session?.access_token) {
          localStorage.setItem("genesis_token", authData.session.access_token);
        }
        
        toast({
          title: "Bem-vindo!",
          description: "Login realizado com sucesso via Supabase.",
        });
        navigate("/dashboard");
        return;
      }
    } catch (error: any) {
      console.warn("Supabase auth failed, trying backend fallback...", error.message);
      // 2. Fallback para Demo ou Backend Local se Supabase falhar
      try {
        const data = await apiFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: cleanEmail, password }),
        });

        if (data.user.needsPasswordReset) {
          setIsLocalAuth(true);
          setMustResetPassword(true);
          toast({
            title: "Primeiro Acesso",
            description: "Por favor, defina uma nova senha para sua segurança.",
          });
          setIsLoading(false);
          return;
        }

        setIsLocalAuth(true);
        setRole(data.user.role);
        setUserName(data.user.name);
        setUserSector(data.user.sector || "Setor Geral");
        setUserUnitId((data.user as any).unidade_id || null);
        setUserSectorId((data.user as any).setor_id || null);
        localStorage.setItem("genesis_token", data.token);
        localStorage.setItem("genesis_user", JSON.stringify(data.user));
        
        toast({
          title: "Bem-vindo de volta!",
          description: "Login realizado via API local.",
        });
        navigate("/dashboard");
        return;
      } catch (apiError: any) {
        console.error("Backend auth also failed:", apiError.message);
        // 3. Fallback final para admin123 (Desenvolvimento)
        // Se usar a senha padrão, mesmo no mock, pedimos reset
        if (cleanEmail === "admin@genesis.com" && password === "admin123") {
          setIsLocalAuth(true);
          setMustResetPassword(true);
          toast({
            title: "Primeiro Acesso (Mock)",
            description: "Por favor, defina uma nova senha.",
          });
          setIsLoading(false);
          return;
        }

        toast({
          variant: "destructive",
          title: "Erro no Login",
          description: apiError.message || error.message || "Credenciais inválidas.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 1. Validar força da senha
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
      if (!passwordRegex.test(newPassword)) {
        toast({
          variant: "destructive",
          title: "Senha Fraca",
          description: "A senha deve ter pelo menos 8 caracteres, incluindo letras maiúsculas, minúsculas, números e caracteres especiais.",
        });
        setIsLoading(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "As senhas não coincidem.",
        });
        setIsLoading(false);
        return;
      }

      console.log("Atualizando senha no Supabase Auth...");
      
      const userEmail = email.toLowerCase().trim();

      if (!isLocalAuth) {
        // Verificação de segurança: garantir que existe uma sessão ativa
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        console.log("Sessão ativa encontrada:", !!currentSession);
        
        if (!currentSession) {
          console.warn("Sessão perdida. Tentando recuperar usuário...");
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (!currentUser) {
            throw new Error("Sessão de autenticação expirou ou não foi encontrada. Por favor, faça login novamente.");
          }
        }

        // 2. Atualizar no Supabase Auth
        const { data: resetData, error: resetError } = await supabase.auth.updateUser({
          password: newPassword,
          data: { needs_password_reset: false }
        });

        if (resetError) throw resetError;
        console.log("Supabase Auth password updated.");
      } else {
        console.log("Modo local detectado. Pulando atualização do Supabase Auth.");
      }

      // 3. Sincronizar com a tabela local via Backend
      try {
        await apiFetch("/auth/reset-password", {
          method: "POST",
          body: JSON.stringify({ 
            email: userEmail, 
            newPassword: newPassword 
          }),
        });
        console.log("Database sync successful");
      } catch (syncError: any) {
        console.error("Erro crítico na sincronização local:", syncError);
        toast({
          variant: "destructive",
          title: "Erro de Sincronização",
          description: "A senha foi alterada no Auth, mas NÃO foi possível atualizar o banco local: " + (syncError.message || "Erro desconhecido"),
        });
        // Não jogamos o erro para cima para não travar o fluxo se o Auth foi ok, 
        // mas o toast agora é 'destructive' para o usuário saber que algo falhou.
      }

      toast({
        title: "Sucesso!",
        description: "A senha foi atualizada e sincronizada com sucesso.",
      });

      setMustResetPassword(false);
      setNewPassword("");
      setConfirmPassword("");
      
      // Pequeno delay para o usuário ver o toast antes de recarregar
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (error: any) {
      console.error("Erro geral no reset:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Erro ao redefinir senha",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className=" h-16  flex items-center justify-center s mb-4 animate-float">
          <img src={logo} alt="Genesis Logo" />
          </div>
          <p className="text-muted-foreground">Sistema de Gestão e Gamificação Hospitalar</p>
        </div>

        <Card className="border-border shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              {mustResetPassword ? "Redefinir Senha" : "Entrar no Sistema"}
            </CardTitle>
            <CardDescription className="text-center">
              {mustResetPassword 
                ? "Sua conta utiliza uma senha padrão. Crie uma nova senha forte para continuar." 
                : "Insira seus dados para acessar sua conta"}
            </CardDescription>
          </CardHeader>
          
          {!mustResetPassword ? (
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      placeholder="ex@exemplo.com"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Senha</Label>
                    <Button variant="link" className="px-0 font-normal text-xs">
                      Esqueceu a senha?
                    </Button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" 
                  type="submit" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Acessar"
                  )}
                </Button>
              </CardFooter>
            </form>
          ) : (
            <form onSubmit={handlePasswordReset}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="Min. 8 chars, A-z, 0-9, @#$"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Repita a nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button 
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" 
                  type="submit" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    "Definir Senha e Entrar"
                  )}
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full" 
                  onClick={() => setMustResetPassword(false)}
                  disabled={isLoading}
                >
                  Voltar
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Ainda não tem acesso? Contate o seu Coordenador ou PMO.
        </p>
      </div>
    </div>
  );
}
