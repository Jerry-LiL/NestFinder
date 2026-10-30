export type UserRole = 'TENANT' | 'MANAGER';

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
