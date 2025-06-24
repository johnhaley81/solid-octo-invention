import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import { useMutation } from '@apollo/client';
import { CURRENT_USER_FROM_SESSION } from '../graphql/queries.ts';

/**
 * User type definition
 */
export interface User {
  id: string;
  email: string;
  name: string;
  authMethod: string;
  createdAt: string;
}

/**
 * Authentication state interface
 */
interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionToken: string | null;
}

/**
 * Authentication actions
 */
type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_SESSION_TOKEN'; payload: string | null }
  | { type: 'LOGIN'; payload: { user: User; sessionToken: string } }
  | { type: 'LOGOUT' };

/**
 * Authentication context interface
 */
interface AuthContextType {
  state: AuthState;
  login: (_user: User, _sessionToken: string) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

/**
 * Initial authentication state
 */
const initialState: AuthState = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  sessionToken: localStorage.getItem('auth-token'),
};

/**
 * Authentication reducer
 */
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
      };
    case 'SET_SESSION_TOKEN':
      return { ...state, sessionToken: action.payload };
    case 'LOGIN':
      return {
        ...state,
        user: action.payload.user,
        sessionToken: action.payload.sessionToken,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        sessionToken: null,
        isAuthenticated: false,
        isLoading: false,
      };
    default:
      return state;
  }
}

/**
 * Authentication context
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication provider component
 */
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const [getCurrentUser] = useMutation(CURRENT_USER_FROM_SESSION);
  // Note: logout is handled client-side by clearing localStorage

  /**
   * Login function - stores user and session token
   */
  const login = (user: User, sessionToken: string) => {
    localStorage.setItem('auth-token', sessionToken);
    dispatch({ type: 'LOGIN', payload: { user, sessionToken } });
  };

  /**
   * Logout function - clears user and session token
   */
  const logout = async () => {
    localStorage.removeItem('auth-token');
    dispatch({ type: 'LOGOUT' });
  };

  /**
   * Check authentication status on app load
   */
  const checkAuth = async () => {
    const token = localStorage.getItem('auth-token');

    if (!token) {
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }

    try {
      const { data } = await getCurrentUser();

      if (data?.currentUserFromSession?.user) {
        dispatch({ type: 'SET_USER', payload: data.currentUserFromSession.user });
        dispatch({ type: 'SET_SESSION_TOKEN', payload: token });
      } else {
        // Invalid token, remove it
        localStorage.removeItem('auth-token');
        dispatch({ type: 'SET_USER', payload: null });
        dispatch({ type: 'SET_SESSION_TOKEN', payload: null });
      }
    } catch (error) {
      // Handle auth check error silently
      localStorage.removeItem('auth-token');
      dispatch({ type: 'SET_USER', payload: null });
      dispatch({ type: 'SET_SESSION_TOKEN', payload: null });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  /**
   * Check authentication on mount
   */
  useEffect(() => {
    checkAuth();
  }, []);

  const contextValue: AuthContextType = {
    state,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use authentication context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
