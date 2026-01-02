import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { Team } from './entities/team.entity';
import { TeamMember, TeamMemberRole, TeamMemberStatus } from './entities/team-member.entity';
import { TeamInvite } from './entities/team-invite.entity';
import { TeamJoinRequest, JoinRequestStatus } from './entities/team-join-request.entity';
import { User } from '../users/entities/user.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { CreateJoinRequestDto } from './dto/create-join-request.dto';
import { ReviewJoinRequestDto } from './dto/review-join-request.dto';
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
    @InjectRepository(TeamJoinRequest)
    private teamJoinRequestRepository: Repository<TeamJoinRequest>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject('SUPABASE_CLIENT')
    private supabase: SupabaseClient,
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
      throw new NotFoundException('팀을 찾을 수 없습니다');
    }

    const member = await this.teamMemberRepository.findOne({
      where: { teamId, userId },
    });

    if (!member) {
      throw new ForbiddenException('팀원이 아닙니다');
    }

    if (member.role !== TeamMemberRole.CAPTAIN) {
      throw new ForbiddenException('팀장만 팀을 삭제할 수 있습니다');
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

  async getTeam(teamId: string) {
    const team = await this.teamRepository.findOne({
      where: { id: teamId },
      relations: ['captain'],
    });

    if (!team) {
      throw new NotFoundException('팀을 찾을 수 없습니다');
    }

    return {
      id: team.id,
      name: team.name,
      region: team.region,
      description: team.description,
      logo: team.logo,
      captain: team.captain ? {
        id: team.captain.id,
        name: team.captain.name,
      } : null,
      createdAt: team.createdAt,
    };
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

  async joinTeam(teamId: string, userId: string, createJoinRequestDto?: CreateJoinRequestDto) {
    // joinTeam은 이제 가입 신청을 생성합니다
    return this.createJoinRequest(teamId, userId, createJoinRequestDto || {});
  }

  async leaveTeam(teamId: string, userId: string) {
    const member = await this.teamMemberRepository.findOne({
      where: { teamId, userId },
    });

    if (!member) {
      throw new NotFoundException('팀 멤버십을 찾을 수 없습니다');
    }

    if (member.role === TeamMemberRole.CAPTAIN) {
      throw new ForbiddenException('팀장은 팀을 떠날 수 없습니다. 대신 팀을 삭제해주세요.');
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
      profileImage: member.user.profileImage,
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
      throw new NotFoundException('팀원을 찾을 수 없습니다');
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
      throw new NotFoundException('팀을 찾을 수 없습니다');
    }

    const targetUser = await this.userRepository.findOne({
      where: { id: addMemberDto.userId },
    });
    if (!targetUser) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    // 이미 해당 팀의 멤버인지 확인
    const existingMember = await this.teamMemberRepository.findOne({
      where: { teamId, userId: addMemberDto.userId },
    });

    if (existingMember) {
      throw new ConflictException('이미 팀원입니다');
    }

    // 다른 팀에 소속되어 있는지 확인
    const otherTeamMember = await this.teamMemberRepository.findOne({
      where: { userId: addMemberDto.userId },
    });

    if (otherTeamMember) {
      throw new ConflictException('이미 다른 팀의 멤버입니다. 먼저 현재 팀에서 제거해주세요.');
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
      throw new NotFoundException('팀원을 찾을 수 없습니다');
    }

    // 부팀장으로 임명하려는 경우 최대 2명 제한 확인
    if (updateMemberDto.role === TeamMemberRole.VICE_CAPTAIN) {
      const currentViceCaptains = await this.teamMemberRepository.find({
        where: {
          teamId,
          role: TeamMemberRole.VICE_CAPTAIN,
        },
      });

      // 현재 부팀장이 2명이고, 변경하려는 멤버가 이미 부팀장이 아닌 경우
      if (currentViceCaptains.length >= 2 && member.role !== TeamMemberRole.VICE_CAPTAIN) {
        throw new BadRequestException('부팀장은 최대 2명까지 임명할 수 있습니다.');
      }
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
      throw new NotFoundException('팀원을 찾을 수 없습니다');
    }

    if (member.role === TeamMemberRole.CAPTAIN) {
      throw new ForbiddenException('팀장은 삭제할 수 없습니다');
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
      throw new NotFoundException('팀을 찾을 수 없습니다');
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

    // 평균 참석률 계산 (현재는 0으로 설정, 추후 경기 데이터 기반으로 계산 가능)
    const averageAttendance = 0;

    return {
      totalMembers: members.length,
      activeMembers: activeMembers.length,
      averageAge: Math.round(averageAge * 10) / 10,
      averageAttendance: averageAttendance,
    };
  }

  async uploadTeamLogo(teamId: string, userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('파일이 업로드되지 않았습니다');
    }

    // 팀장 권한 확인
    const member = await this.teamMemberRepository.findOne({
      where: { teamId, userId },
    });

    if (!member) {
      throw new ForbiddenException('팀원이 아닙니다');
    }

    if (member.role !== TeamMemberRole.CAPTAIN) {
      throw new ForbiddenException('팀장만 팀 로고를 업로드할 수 있습니다');
    }

    // 파일 확장자 검증
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'JPEG, PNG, WebP 이미지만 허용됩니다',
      );
    }

    // 파일 크기 검증 (5MB 제한)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('파일 크기는 5MB 미만이어야 합니다');
    }

    const team = await this.teamRepository.findOne({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException('팀을 찾을 수 없습니다');
    }

    // 기존 로고가 있으면 삭제
    if (team.logo) {
      try {
        const oldUrl = new URL(team.logo);
        const pathParts = oldUrl.pathname.split('/');
        const fileName = pathParts[pathParts.length - 1];
        const filePath = `teams/${teamId}/${fileName}`;

        await this.supabase.storage
          .from('team-logos')
          .remove([filePath]);
      } catch (error) {
        // 기존 파일 삭제 실패는 무시 (이미 삭제되었을 수 있음)
        console.warn('Failed to delete old team logo:', error);
      }
    }

    // 새 파일명 생성
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const filePath = `teams/${teamId}/${fileName}`;

    // Supabase Storage에 업로드
    const { data, error } = await this.supabase.storage
      .from('team-logos')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw new BadRequestException(`이미지 업로드 실패: ${error.message}`);
    }

    // Public URL 생성
    const { data: urlData } = this.supabase.storage
      .from('team-logos')
      .getPublicUrl(filePath);

    // DB에 URL 저장
    team.logo = urlData.publicUrl;
    await this.teamRepository.save(team);

    return {
      logoUrl: urlData.publicUrl,
    };
  }

  async cleanupDuplicateMemberships(userId: string) {
    const memberships = await this.teamMemberRepository.find({
      where: { userId },
      relations: ['team'],
      order: { joinedAt: 'DESC' },
    });

    if (memberships.length <= 1) {
      return { message: 'No duplicate memberships found', kept: memberships[0]?.id || null };
    }

    // 팀장인 팀이 있으면 그 팀을 유지, 없으면 가장 최근에 가입한 팀 유지
    const captainMembership = memberships.find(m => m.role === TeamMemberRole.CAPTAIN);
    const membershipToKeep = captainMembership || memberships[0];
    const membershipsToRemove = memberships.filter(m => m.id !== membershipToKeep.id);

    // 중복 멤버십 삭제
    await this.teamMemberRepository.remove(membershipsToRemove);

    return {
      message: `Cleaned up ${membershipsToRemove.length} duplicate membership(s)`,
      kept: {
        teamId: membershipToKeep.teamId,
        teamName: membershipToKeep.team?.name,
        role: membershipToKeep.role,
      },
      removed: membershipsToRemove.map(m => ({
        teamId: m.teamId,
        teamName: m.team?.name,
      })),
    };
  }

  async createJoinRequest(teamId: string, userId: string, createJoinRequestDto: CreateJoinRequestDto) {
    const team = await this.teamRepository.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('팀을 찾을 수 없습니다');
    }

    // 이미 해당 팀의 멤버인지 확인
    const existingMember = await this.teamMemberRepository.findOne({
      where: { teamId, userId },
    });

    if (existingMember) {
      throw new ConflictException('이미 팀원입니다');
    }

    // 다른 팀에 소속되어 있는지 확인
    const otherTeamMember = await this.teamMemberRepository.findOne({
      where: { userId },
    });

    if (otherTeamMember) {
      throw new ConflictException('이미 다른 팀의 멤버입니다. 먼저 현재 팀을 떠나주세요.');
    }

    // 다른 팀에 대기 중인 가입 신청이 있는지 확인
    const pendingRequest = await this.teamJoinRequestRepository.findOne({
      where: {
        userId,
        status: JoinRequestStatus.PENDING,
      },
      relations: ['team'],
    });

    if (pendingRequest) {
      throw new ConflictException(`이미 "${pendingRequest.team.name}" 팀에 가입 신청이 대기 중입니다. 응답을 기다리거나 기존 신청을 취소해주세요.`);
    }

    // 이미 해당 팀에 대기 중인 가입 신청이 있는지 확인 (중복 체크)
    const existingRequest = await this.teamJoinRequestRepository.findOne({
      where: {
        teamId,
        userId,
        status: JoinRequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new ConflictException('가입 신청이 이미 대기 중입니다');
    }

    // 가입 신청 생성
    const joinRequest = this.teamJoinRequestRepository.create({
      teamId,
      userId,
      message: createJoinRequestDto?.message,
      status: JoinRequestStatus.PENDING,
    });

    return this.teamJoinRequestRepository.save(joinRequest);
  }

  async getJoinRequests(teamId: string, userId: string) {
    // 팀장 권한 확인
    const member = await this.teamMemberRepository.findOne({
      where: { teamId, userId },
    });

    if (!member) {
      throw new ForbiddenException('팀원이 아닙니다');
    }

    if (member.role !== TeamMemberRole.CAPTAIN && member.role !== TeamMemberRole.VICE_CAPTAIN) {
      throw new ForbiddenException('팀장 또는 부팀장만 가입 신청을 볼 수 있습니다');
    }

    const requests = await this.teamJoinRequestRepository.find({
      where: { teamId },
      relations: ['user', 'user.positions'],
      order: { createdAt: 'DESC' },
    });

    return requests.map((request) => ({
      id: request.id,
      userId: request.user.id,
      userName: request.user.name,
      message: request.message,
      status: request.status,
      positions: request.user.positions?.map((p) => p.position) || [],
      phone: request.user.phone,
      birthdate: request.user.birthdate,
      summary: request.user.summary,
      createdAt: request.createdAt,
      reviewedAt: request.reviewedAt,
    }));
  }

  async reviewJoinRequest(
    teamId: string,
    requestId: string,
    userId: string,
    reviewJoinRequestDto: ReviewJoinRequestDto,
  ) {
    // 팀장 권한 확인
    const member = await this.teamMemberRepository.findOne({
      where: { teamId, userId },
    });

    if (!member) {
      throw new ForbiddenException('팀원이 아닙니다');
    }

    if (member.role !== TeamMemberRole.CAPTAIN && member.role !== TeamMemberRole.VICE_CAPTAIN) {
      throw new ForbiddenException('팀장 또는 부팀장만 가입 신청을 검토할 수 있습니다');
    }

    const joinRequest = await this.teamJoinRequestRepository.findOne({
      where: { id: requestId, teamId },
      relations: ['user'],
    });

    if (!joinRequest) {
      throw new NotFoundException('가입 신청을 찾을 수 없습니다');
    }

    if (joinRequest.status !== JoinRequestStatus.PENDING) {
      throw new BadRequestException('가입 신청이 이미 검토되었습니다');
    }

    // 승인인 경우
    if (reviewJoinRequestDto.status === JoinRequestStatus.APPROVED) {
      // 이미 다른 팀에 소속되어 있는지 확인
      const otherTeamMember = await this.teamMemberRepository.findOne({
        where: { userId: joinRequest.userId },
      });

      if (otherTeamMember) {
        throw new ConflictException('이미 다른 팀의 멤버입니다');
      }

      // 팀원으로 추가
      const newMember = this.teamMemberRepository.create({
        teamId,
        userId: joinRequest.userId,
        role: TeamMemberRole.MEMBER,
        status: TeamMemberStatus.ACTIVE,
      });

      await this.teamMemberRepository.save(newMember);
    }

    // 신청 상태 업데이트
    joinRequest.status = reviewJoinRequestDto.status;
    joinRequest.reviewedBy = userId;
    joinRequest.reviewedAt = new Date();

    await this.teamJoinRequestRepository.save(joinRequest);

    return {
      id: joinRequest.id,
      status: joinRequest.status,
      reviewedAt: joinRequest.reviewedAt,
    };
  }

  async getMyJoinRequests(userId: string) {
    const requests = await this.teamJoinRequestRepository.find({
      where: { userId },
      relations: ['team', 'team.captain'],
      order: { createdAt: 'DESC' },
    });

    return requests.map((request) => ({
      id: request.id,
      teamId: request.team.id,
      teamName: request.team.name,
      message: request.message,
      status: request.status,
      createdAt: request.createdAt,
      reviewedAt: request.reviewedAt,
    }));
  }

  async cancelJoinRequest(requestId: string, userId: string) {
    const joinRequest = await this.teamJoinRequestRepository.findOne({
      where: { id: requestId },
      relations: ['team'],
    });

    if (!joinRequest) {
      throw new NotFoundException('가입 신청을 찾을 수 없습니다');
    }

    // 본인의 신청인지 확인
    if (joinRequest.userId !== userId) {
      throw new ForbiddenException('본인의 가입 신청만 취소할 수 있습니다');
    }

    // 이미 검토된 신청은 취소 불가
    if (joinRequest.status !== JoinRequestStatus.PENDING) {
      throw new BadRequestException('이미 검토된 가입 신청은 취소할 수 없습니다');
    }

    await this.teamJoinRequestRepository.remove(joinRequest);

    return {
      success: true,
      message: '가입 신청이 취소되었습니다',
    };
  }

  private async checkTeamPermission(teamId: string, userId: string) {
    const member = await this.teamMemberRepository.findOne({
      where: { teamId, userId },
    });

    if (!member) {
      throw new ForbiddenException('팀원이 아닙니다');
    }

    if (
      member.role !== TeamMemberRole.CAPTAIN &&
      member.role !== TeamMemberRole.VICE_CAPTAIN
    ) {
      throw new ForbiddenException('팀장 또는 부팀장만 이 작업을 수행할 수 있습니다');
    }
  }
}
