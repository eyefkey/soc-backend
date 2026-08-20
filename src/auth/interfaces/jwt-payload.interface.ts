import { UserRole } from '../../../generated/prisma/enums';

export interface JwtPayload {
  sub: string;
  username: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}
