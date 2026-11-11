import { IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ILocation } from '@taxi-rio/shared';

export class LocationDto implements ILocation {
  @IsNotEmpty({ message: 'A latitude é obrigatória.' })
  @IsNumber({}, { message: 'A latitude deve ser um número válido.' })
  latitude!: number;

  @IsNotEmpty({ message: 'A longitude é obrigatória.' })
  @IsNumber({}, { message: 'A longitude deve ser um número válido.' })
  longitude!: number;

  @IsOptional()
  @IsString({ message: 'O endereço deve ser uma string.' })
  address?: string;
}

export class CreateRideDto {
  @IsNotEmpty({ message: 'A origem é obrigatória.' })
  @ValidateNested()
  @Type(() => LocationDto)
  origin!: LocationDto;

  @IsNotEmpty({ message: 'O destino é obrigatório.' })
  @ValidateNested()
  @Type(() => LocationDto)
  destination!: LocationDto;
}
