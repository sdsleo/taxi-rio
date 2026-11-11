import { IsEnum, IsNotEmpty } from 'class-validator';
import { RideStatus, IUpdateRideStatusDto } from '@taxi-rio/shared';

export class UpdateRideStatusDto implements IUpdateRideStatusDto {
  @IsNotEmpty({ message: 'O status é obrigatório.' })
  @IsEnum(RideStatus, {
    message: `O status deve ser um dos seguintes valores: ${Object.values(RideStatus).join(', ')}`,
  })
  status!: RideStatus;
}
