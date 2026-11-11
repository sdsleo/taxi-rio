import {
  Controller,
  Post,
  Patch,
  Get,
  Param,
  Body,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { UserRole, IJwtPayload } from '@taxi-rio/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CorridasService } from './corridas.service';
import { CreateRideDto } from './dto/create-ride.dto';
import { UpdateRideStatusDto } from './dto/update-ride-status.dto';

@Controller('corridas')
export class CorridasController {
  constructor(private readonly corridasService: CorridasService) {}

  /**
   * POST /corridas — Criação de corrida (exclusivo para perfil PASSENGER)
   * Suporta Idempotency-Key para prevenção de duplicação.
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PASSENGER)
  async createRide(
    @CurrentUser() user: IJwtPayload,
    @Body() dto: CreateRideDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.corridasService.createRide(
      user.sub,
      dto,
      idempotencyKey,
      correlationId,
    );

    if (result.isIdempotentReplay) {
      res.setHeader('X-Idempotent-Replay', 'true');
    }

    res.status(HttpStatus.CREATED);
    return result.data;
  }

  /**
   * PATCH /corridas/:id/status — Alteração de status (exclusivo para perfil DRIVER)
   */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: IJwtPayload,
    @Body() dto: UpdateRideStatusDto,
    @Headers('x-correlation-id') correlationId: string | undefined,
  ) {
    return this.corridasService.updateStatus(id, user.sub, dto.status, correlationId);
  }

  /**
   * GET /corridas/:id — Leitura de corrida com Cache no Redis (autenticado)
   * Passageiro só acessa a própria corrida (RBAC 403 se for de outro).
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getRideById(@Param('id') id: string, @CurrentUser() user: IJwtPayload) {
    return this.corridasService.getRideById(id, user.sub, user.role);
  }

  /**
   * GET /corridas — Listagem de corridas por perfil
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async listRides(@CurrentUser() user: IJwtPayload) {
    return this.corridasService.listRides(user.sub, user.role);
  }
}
