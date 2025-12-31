import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from './entities/team.entity';
import { TeamMember, TeamMemberRole, TeamMemberStatus } from './entities/team-member.entity';
import { TeamInvite } from './entities/team-invite.entity';
import { User } from '../users/entities/user.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import * as crypto from 'crypto';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private teamRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private teamMemberRepository: Repository<TeamMember>,
    @InjectRepository(TeamInvite)
    private teamInviteRepository: Repository<TeamInvite>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createTeam(userId: string, createTeamDto: CreateTeamDto) {
    const team = this.teamRepository.create({
      name: createTeamDto.name,
      captainId: userId,
    });

    const savedTeam = await this.teamRepository.save(team);

    // 팀장을 팀원으로 추가
    const captainMember = this.teamMemberRepository.create({
      teamId: savedTeam.id,
      userId,
      role: TeamMemberRole.CAPTAIN,
      status: TeamMemberStatus.ACTIVE,
    });

    await this.teamMemberRepository.save(captainMember);

    return savedTeam;
  }

  async deleteTeam(teamId: string, userId: string) {
    const team = await this.teamRepository.findOne({
      where: { id: teamId },
      relations: ['members'],
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const member = await this.teamMemberRepository.findOne({
      where: { teamId, userId },
    });

    if (!member) {
      throw new ForbiddenException('Not a team member');
    }

    if (member.role !== TeamMemberRole.CAPTAIN) {
      throw new ForbiddenException('Only team captain can delete the team');
    }

    // 팀원 모두 삭제
    await this.teamMemberRepository.remove(team.members || []);
    
    // 팀 삭제
    await this.teamRepository.remove(team);
    
    return { success: true };
  }

  async getPublicTeams() {
    return this.teamRepository.find({
      relations: ['captain'],
      order: { createdAt: 'DESC' },
    });
  }

  async getUserTeam(userId: string) {
    const member = await this.teamMemberRepository.findOne({
      where: { userId },
      relations: ['team'],
    });

    if (!member) {
      return null;
    }

    return {
      teamId: member.teamId,
      teamName: member.team.name,
      role: member.role,
      status: member.status,
    };
  }

  async joinTeam(teamId: string, userId: string) {
    const team = await this.teamRepository.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const existingMember = await this.teamMemberRepository.findOne({
      where: { teamId, userId },
    });

    if (existingMember) {
      throw new ConflictException('User is already a team member');
    }

    const member = this.teamMemberRepository.create({
      teamId,
      userId,
      role: TeamMemberRole.MEMBER,
      status: TeamMemberStatus.ACTIVE,
    });

    return this.teamMemberRepository.save(member);
  }

  async leaveTeam(teamId: string, userId: string) {
    const member = await this.teamMemberRepository.findOne({
      where: { teamId, userId },
    });

    if (!member) {
      throw new NotFoundException('Team membership not found');
    }

    if (member.role === TeamMemberRole.CAPTAIN) {
      throw new ForbiddenException('Team captain cannot leave the team. Please delete the team instead.');
    }

    await this.teamMemberRepository.remove(member);
    return { success: true };
  }

  async getTeamMembers(teamId: string) {
    const members = await this.teamMemberRepository.find({
      where: { teamId },
      relations: ['user', 'user.positions'],
      order: { joinedAt: 'ASC' },
    });

    return members.map((member) => ({
      id: member.id,
      userId: member.user.id,
      name: member.user.name,
      jerseyNumber: member.jerseyNumber,
      role: member.role,
      status: member.status,
      positions: member.user.positions?.map((p) => p.position) || [],
      phone: member.user.phone,
      birthdate: member.user.birthdate,
      joinedAt: member.joinedAt,
    }));
  }

  async getTeamMember(teamId: string, memberId: string) {
    const member = await this.teamMemberRepository.findOne({
      where: { id: memberId, teamId },
      relations: ['user', 'user.positions'],
    });

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    return {
      id: member.id,
      userId: member.user.id,
      name: member.user.name,
      jerseyNumber: member.jerseyNumber,
      role: member.role,
      status: member.status,
      positions: member.user.positions?.map((p) => p.position) || [],
      phone: member.user.phone,
      birthdate: member.user.birthdate,
      summary: member.user.summary,
      joinedAt: member.joinedAt,
    };
  }

  async addMember(
    teamId: string,
    userId: string,
    addMemberDto: AddMemberDto,
    requesterId: string,
  ) {
    await this.checkTeamPermission(teamId, requesterId);

    const team = await this.teamRepository.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const targetUser = await this.userRepository.findOne({
      where: { id: addMemberDto.userId },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const existingMember = await this.teamMemberRepository.findOne({
      where: { teamId, userId: addMemberDto.userId },
    });

    if (existingMember) {
      throw new ConflictException('User is already a team member');
    }

    const member = this.teamMemberRepository.create({
      teamId,
      userId: addMemberDto.userId,
      jerseyNumber: addMemberDto.jerseyNumber,
      status: addMemberDto.status || TeamMemberStatus.ACTIVE,
      role: TeamMemberRole.MEMBER,
    });

    return this.teamMemberRepository.save(member);
  }

  async updateMember(
    teamId: string,
    memberId: string,
    updateMemberDto: UpdateMemberDto,
    requesterId: string,
  ) {
    await this.checkTeamPermission(teamId, requesterId);

    const member = await this.teamMemberRepository.findOne({
      where: { id: memberId, teamId },
    });

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    if (updateMemberDto.jerseyNumber !== undefined) {
      member.jerseyNumber = updateMemberDto.jerseyNumber;
    }
    if (updateMemberDto.role !== undefined) {
      member.role = updateMemberDto.role;
    }
    if (updateMemberDto.status !== undefined) {
      member.status = updateMemberDto.status;
    }

    return this.teamMemberRepository.save(member);
  }

  async deleteMember(teamId: string, memberId: string, requesterId: string) {
    await this.checkTeamPermission(teamId, requesterId);

    const member = await this.teamMemberRepository.findOne({
      where: { id: memberId, teamId },
    });

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    if (member.role === TeamMemberRole.CAPTAIN) {
      throw new ForbiddenException('Cannot delete team captain');
    }

    await this.teamMemberRepository.remove(member);
    return { success: true };
  }

  async createInviteLink(teamId: string, userId: string) {
    await this.checkTeamPermission(teamId, userId);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7일 후 만료

    const invite = this.teamInviteRepository.create({
      teamId,
      token,
      createdBy: userId,
      expiresAt,
      used: false,
    });

    await this.teamInviteRepository.save(invite);

    return { token, expiresAt };
  }

  async getTeamStats(teamId: string) {
    const team = await this.teamRepository.findOne({
      where: { id: teamId },
      relations: ['members', 'members.user'],
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const members = team.members || [];
    const activeMembers = members.filter(
      (m) => m.status === TeamMemberStatus.ACTIVE,
    );

    // 평균 연령 계산
    let totalAge = 0;
    let ageCount = 0;
    activeMembers.forEach((member) => {
      if (member.user.birthdate) {
        const birthdate = new Date(member.user.birthdate);
        const today = new Date();
        const age = today.getFullYear() - birthdate.getFullYear();
        totalAge += age;
        ageCount++;
      }
    });

    const averageAge = ageCount > 0 ? totalAge / ageCount : 0;

    return {
      totalMembers: members.length,
      activeMembers: activeMembers.length,
      averageAge: Math.round(averageAge * 10) / 10,
    };
  }

  private async checkTeamPermission(teamId: string, userId: string) {
    const member = await this.teamMemberRepository.findOne({
      where: { teamId, userId },
    });

    if (!member) {
      throw new ForbiddenException('Not a team member');
    }

    if (
      member.role !== TeamMemberRole.CAPTAIN &&
      member.role !== TeamMemberRole.VICE_CAPTAIN
    ) {
      throw new ForbiddenException('Only captain or vice captain can perform this action');
    }
  }
}

