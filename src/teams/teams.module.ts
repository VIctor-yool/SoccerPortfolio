import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { Team } from './entities/team.entity';
import { TeamMember } from './entities/team-member.entity';
import { TeamInvite } from './entities/team-invite.entity';
import { TeamJoinRequest } from './entities/team-join-request.entity';
import { User } from '../users/entities/user.entity';
import { createSupabaseClient } from '../common/config/supabase.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Team, TeamMember, TeamInvite, TeamJoinRequest, User]),
    ConfigModule,
  ],
  controllers: [TeamsController],
  providers: [
    TeamsService,
    {
      provide: 'SUPABASE_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createSupabaseClient(configService),
    },
  ],
  exports: [TeamsService],
})
export class TeamsModule {}

