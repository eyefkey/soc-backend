import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { OptionalAuth } from './decorators/optional-auth.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /*
   * Public so the very first ADMIN can be created on an empty system.
   * Once any user exists the service itself requires an ADMIN caller, and
   * an anonymous request is rejected there.
   */
  @OptionalAuth()
  @Post('register')
  register(@Body() dto: RegisterDto, @CurrentUser() actor?: AuthenticatedUser) {
    return this.authService.register(dto, actor);
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }
}
