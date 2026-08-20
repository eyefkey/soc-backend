import { IsString } from 'class-validator';

export class LoginDto {
  /*
   * Accepts either the username or the email address.
   */
  @IsString()
  identifier: string;

  @IsString()
  password: string;
}
