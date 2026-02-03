import { createContext, useContext, useState, ReactNode } from "react";

export type UserRole = "pmo" | "coordinator" | "collaborator";

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

const getRolePermissions = (role: UserRole) => {
  switch (role) {
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
    case "coordinator":
      return {
        canValidateChecklists: true,
        canJudgeDisputes: false,
        canManageUsers: false,
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

const getRoleInfo = (role: UserRole) => {
  switch (role) {
    case "pmo":
      return { userName: "Dr. Carlos Mendes", userSector: "Administração Central" };
    case "coordinator":
      return { userName: "Dra. Maria Santos", userSector: "Cardiologia" };
    case "collaborator":
      return { userName: "João Silva", userSector: "UTI" };
  }
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem("genesis_user");
    if (saved) {
      try {
        const user = JSON.parse(saved);
        return user.role || "pmo";
      } catch (e) {
        return "pmo";
      }
    }
    return "pmo";
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
    return "Dr. Carlos Mendes";
  });

  const [userSector, setUserSector] = useState(() => {
    const saved = localStorage.getItem("genesis_user");
    if (saved) {
      try {
        const user = JSON.parse(saved);
        return user.sector || "Administração";
      } catch (e) {
        return "Administração";
      }
    }
    return "Administração Central";
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
    setRoleState(newRole);
    // Para fins de demo, as iniciais mudam com o cargo se não houver um usuário real
    if (!localStorage.getItem("genesis_user")) {
      const info = getRoleInfo(newRole);
      setUserName(info.userName);
      setUserSector(info.userSector);
    }
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
