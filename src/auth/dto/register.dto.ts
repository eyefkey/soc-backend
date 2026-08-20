import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../../generated/prisma/enums';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(12, {
    message: 'password must be at least 12 characters',
  })
  password: string;

  /*
   * Honoured only for callers who are already an ADMIN. The very first
   * account ignores this and is promoted to ADMIN to bootstrap the system.
   */
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
