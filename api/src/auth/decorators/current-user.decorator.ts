import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IJwtPayload } from '@taxi-rio/shared';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): IJwtPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: IJwtPayload }>();
    return request.user;
  },
);
