import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserPosition } from './entities/user-position.entity';
import { createSupabaseClient } from '../common/config/supabase.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserPosition]),
    ConfigModule,
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    {
      provide: 'SUPABASE_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createSupabaseClient(configService),
    },
  ],
  exports: [UsersService],
})
export class UsersModule {}

