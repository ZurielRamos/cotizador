import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class WarmupTierDto {
  @IsInt()
  @Min(0)
  tier: number;

  @IsString()
  label: string;

  @IsInt()
  @Min(0)
  minDays: number;

  @IsInt()
  @Min(0)
  dailyLimit: number;

  @IsInt()
  @Min(0)
  hourlyLimit: number;

  @IsInt()
  @Min(0)
  minDelaySeconds: number;

  @IsInt()
  @Min(0)
  maxDelaySeconds: number;
}

export class UpdateWarmupConfigDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WarmupTierDto)
  tiers?: WarmupTierDto[];

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  windowStartHour?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  windowEndHour?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  pauseThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minReputationMultiplier?: number;
}
