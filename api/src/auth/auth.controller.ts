import { Controller, Get } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole, IJwtPayload } from '@taxi-rio/shared';

@Controller('auth')
export class AuthController {
  constructor(private readonly jwtService: JwtService) {}

  @Get('tokens')
  getTestTokens() {
    const passengerPayload: IJwtPayload = {
      sub: 'pass_11111111-1111-1111-1111-111111111111',
      role: UserRole.PASSENGER,
      name: 'Maria Passageira',
      email: 'maria.passageira@exemplo.rio',
    };

    const driverPayload: IJwtPayload = {
      sub: 'driv_22222222-2222-2222-2222-222222222222',
      role: UserRole.DRIVER,
      name: 'João Taxista',
      email: 'joao.taxista@exemplo.rio',
    };

    const passengerToken = this.jwtService.sign(passengerPayload, { expiresIn: '7d' });
    const driverToken = this.jwtService.sign(driverPayload, { expiresIn: '7d' });

    return {
      message: 'Tokens de teste válidos para o Taxi.Rio (expiram em 7 dias)',
      passenger: {
        userId: passengerPayload.sub,
        role: passengerPayload.role,
        name: passengerPayload.name,
        token: passengerToken,
        authHeader: `Bearer ${passengerToken}`,
      },
      driver: {
        userId: driverPayload.sub,
        role: driverPayload.role,
        name: driverPayload.name,
        token: driverToken,
        authHeader: `Bearer ${driverToken}`,
      },
    };
  }
}
