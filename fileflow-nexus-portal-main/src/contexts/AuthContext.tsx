import React, { createContext, useContext, useState, useEffect } from "react";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://pfkhlrctrevcibkawqvy.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBma2hscmN0cmV2Y2lia2F3cXZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMTA5ODAsImV4cCI6MjA2NDc4Njk4MH0.U_c__wY99tU4Zo1g3rMVwyo_btM7LpAF3612gB31064";
const supabase = createClient(supabaseUrl, supabaseKey);

type UserType = "client" | "staff";

interface DocumentType {
  id: string;
  name: string;
  description: string;
  allowedExtensions: string[];
  ftpConfig: {
    host: string;
    username: string;
    password: string;
  };
}

interface Company {
  id: string;
  name: string;
  documentTypes: DocumentType[];
}

interface User {
  id: string;
  name: string;
  email: string;
  type: UserType;
  companies: Company[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Fetch user data including companies and document types
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          id,
          name,
          email,
          type,
          user_companies (
            company:companies (
              id,
              name,
              company_document_types (
                document_type:document_types (
                  id,
                  name,
                  description,
                  allowed_extensions,
                  ftp_config
                )
              )
            )
          )
        `)
        .eq('id', data.user.id)
        .single();

      if (userError) throw userError;

      // Transform the data to match our User interface
      const transformedUser: User = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        type: userData.type,
        companies: userData.user_companies.map((uc: any) => ({
          id: uc.company.id,
          name: uc.company.name,
          documentTypes: uc.company.company_document_types.map((cdt: any) => ({
            id: cdt.document_type.id,
            name: cdt.document_type.name,
            description: cdt.document_type.description,
            allowedExtensions: cdt.document_type.allowed_extensions,
            ftpConfig: cdt.document_type.ftp_config
          }))
        }))
      };

      localStorage.setItem("user", JSON.stringify(transformedUser));
      setUser(transformedUser);
    } catch (error) {
      console.error("Erro no login:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem("user");
      setUser(null);
    } catch (error) {
      console.error("Erro no logout:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
