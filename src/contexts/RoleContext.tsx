import { createContext, useContext, useState, ReactNode } from "react";

export type UserRole = "pmo" | "manager" | "collaborator";

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  userName: string;
  setUserName: (name: string) => void;
  userSector: string;
  setUserSector: (sector: string) => void;
  userUnitId: string | null;
  setUserUnitId: (id: string | null) => void;
  userSectorId: string | null;
  setUserSectorId: (id: string | null) => void;
  isAuthenticated?: boolean;
  rolePermissions: {
    canValidateChecklists: boolean;
    canJudgeDisputes: boolean;
    canManageUsers: boolean;
    canManageSectors: boolean;
    canReportErrors: boolean;
    canAssignTasks: boolean;
    canViewAllSectors: boolean;
    canExportReports: boolean;
    canImportChecklists: boolean;
  };
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const normalizeRole = (role: string): UserRole => {
  if (!role) return "pmo";
  const r = role.toLowerCase();
  if (r === "pmo") return "pmo";
  if (r === "manager" || r === "coordinator" || r === "coordenador" || r === "gestor") return "manager";
  if (r === "collaborator" || r === "colaborador") return "collaborator";
  return "pmo"; // Default
};

const getRolePermissions = (role: UserRole) => {
  switch (normalizeRole(role)) {
    case "pmo":
      return {
        canValidateChecklists: true,
        canJudgeDisputes: true,
        canManageUsers: true,
        canManageSectors: true,
        canReportErrors: true,
        canAssignTasks: true,
        canViewAllSectors: true,
        canExportReports: true,
        canImportChecklists: true,
      };
    case "manager":
      return {
        canValidateChecklists: true,
        canJudgeDisputes: false,
        canManageUsers: true,
        canManageSectors: false,
        canReportErrors: true,
        canAssignTasks: true,
        canViewAllSectors: false,
        canExportReports: true,
        canImportChecklists: true,
      };
    case "collaborator":
      return {
        canValidateChecklists: false,
        canJudgeDisputes: false,
        canManageUsers: false,
        canManageSectors: false,
        canReportErrors: true,
        canAssignTasks: false,
        canViewAllSectors: false,
        canExportReports: false,
        canImportChecklists: false,
      };
  }
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem("genesis_user");
    if (saved) {
      try {
        const user = JSON.parse(saved);
        return normalizeRole(user.role);
      } catch (e) {
        return "collaborator"; // Default mais seguro se der erro
      }
    }
    return "collaborator"; // Default inicial seguro
  });

  const [userName, setUserName] = useState(() => {
    const saved = localStorage.getItem("genesis_user");
    if (saved) {
      try {
        const user = JSON.parse(saved);
        return user.name || user.full_name || "Usuário";
      } catch (e) {
        return "Usuário";
      }
    }
    return "";
  });

  const [userSector, setUserSector] = useState(() => {
    const saved = localStorage.getItem("genesis_user");
    if (saved) {
      try {
        const user = JSON.parse(saved);
        return user.sector || "";
      } catch (e) {
        return "";
      }
    }
    return "";
  });

  const [userUnitId, setUserUnitId] = useState<string | null>(() => {
    const saved = localStorage.getItem("genesis_user");
    if (saved) {
      try {
        const user = JSON.parse(saved);
        return user.unidade_id || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [userSectorId, setUserSectorId] = useState<string | null>(() => {
    const saved = localStorage.getItem("genesis_user");
    if (saved) {
      try {
        const user = JSON.parse(saved);
        return user.setor_id || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const setRole = (newRole: UserRole) => {
    setRoleState(normalizeRole(newRole));
  };

  const isAuthenticated = !!localStorage.getItem("genesis_token") || !!localStorage.getItem("genesis_user");

  const rolePermissions = getRolePermissions(role);

  return (
    <RoleContext.Provider value={{ 
      role, 
      setRole, 
      userName, 
      setUserName, 
      userSector, 
      setUserSector, 
      userUnitId,
      setUserUnitId,
      userSectorId,
      setUserSectorId,
      rolePermissions, 
      isAuthenticated 
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}
