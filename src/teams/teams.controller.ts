import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  async createTeam(
    @CurrentUser() user: User,
    @Body() createTeamDto: CreateTeamDto,
  ) {
    return this.teamsService.createTeam(user.id, createTeamDto);
  }

  @Get('public')
  async getPublicTeams() {
    return this.teamsService.getPublicTeams();
  }

  @Get('my-team')
  async getMyTeam(@CurrentUser() user: User) {
    return this.teamsService.getUserTeam(user.id);
  }

  @Post(':teamId/join')
  async joinTeam(
    @Param('teamId') teamId: string,
    @CurrentUser() user: User,
  ) {
    return this.teamsService.joinTeam(teamId, user.id);
  }

  @Get(':teamId/members')
  async getTeamMembers(@Param('teamId') teamId: string) {
    return this.teamsService.getTeamMembers(teamId);
  }

  @Get(':teamId/members/:memberId')
  async getTeamMember(
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.teamsService.getTeamMember(teamId, memberId);
  }

  @Post(':teamId/members')
  async addMember(
    @Param('teamId') teamId: string,
    @CurrentUser() user: User,
    @Body() addMemberDto: AddMemberDto,
  ) {
    return this.teamsService.addMember(teamId, user.id, addMemberDto, user.id);
  }

  @Put(':teamId/members/:memberId')
  async updateMember(
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: User,
    @Body() updateMemberDto: UpdateMemberDto,
  ) {
    return this.teamsService.updateMember(
      teamId,
      memberId,
      updateMemberDto,
      user.id,
    );
  }

  @Delete(':teamId/members/:memberId')
  async deleteMember(
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: User,
  ) {
    return this.teamsService.deleteMember(teamId, memberId, user.id);
  }

  @Post(':teamId/invite')
  async createInviteLink(
    @Param('teamId') teamId: string,
    @CurrentUser() user: User,
  ) {
    return this.teamsService.createInviteLink(teamId, user.id);
  }

  @Get(':teamId/stats')
  async getTeamStats(@Param('teamId') teamId: string) {
    return this.teamsService.getTeamStats(teamId);
  }
}

