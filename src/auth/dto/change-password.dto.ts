import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(12, {
    message: 'newPassword must be at least 12 characters',
  })
  newPassword: string;
}
