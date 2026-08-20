import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { Throttle } from '@nestjs/throttler';

import { UserRole } from '../../generated/prisma/enums';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { Public } from './decorators/public.decorator';
import { OptionalAuth } from './decorators/optional-auth.decorator';
import { MinRole } from './decorators/min-role.decorator';
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
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @OptionalAuth()
  @Post('register')
  register(@Body() dto: RegisterDto, @CurrentUser() actor?: AuthenticatedUser) {
    return this.authService.register(dto, actor);
  }

  /*
   * Password guessing is the attack this endpoint invites, and every
   * attempt costs a deliberately slow hash, so the limit is tight.
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
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

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @MinRole(UserRole.ADMIN)
  @Get('users')
  listUsers(@Query() query: QueryUsersDto) {
    return this.authService.listUsers(query);
  }

  @MinRole(UserRole.ADMIN)
  @Patch('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.authService.updateUser(id, dto, actor);
  }
}
