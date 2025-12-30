import { SetMetadata } from '@nestjs/common';
import { TeamMemberRole } from '../../teams/entities/team-member.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: TeamMemberRole[]) => SetMetadata(ROLES_KEY, roles);

