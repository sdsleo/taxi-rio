import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IJwtPayload, UserRole } from '@taxi-rio/shared';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev_jwt_secret_key_taxi_rio_super_secure_example',
    });
  }

  validate(payload: Partial<IJwtPayload>): IJwtPayload {
    if (!payload.sub || !payload.role) {
      throw new UnauthorizedException('Token inválido: payload incompleto.');
    }

    if (!Object.values(UserRole).includes(payload.role as UserRole)) {
      throw new UnauthorizedException('Token inválido: perfil de usuário não reconhecido.');
    }

    return {
      sub: payload.sub,
      role: payload.role as UserRole,
      name: payload.name || 'Usuário Taxi.Rio',
      email: payload.email,
    };
  }
}
