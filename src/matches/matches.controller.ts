import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { RecordMatchDto } from './dto/record-match.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post()
  async createMatch(
    @CurrentUser() user: User,
    @Body() createMatchDto: CreateMatchDto,
  ) {
    return this.matchesService.createMatch(user.id, createMatchDto);
  }

  @Get()
  async getMatches(
    @Query('teamId') teamId: string,
    @Query('year') year?: number,
    @Query('month') month?: number,
  ) {
    return this.matchesService.getMatches(
      teamId,
      year ? parseInt(year.toString()) : undefined,
      month ? parseInt(month.toString()) : undefined,
    );
  }

  @Get(':id')
  async getMatch(@Param('id') id: string) {
    return this.matchesService.getMatch(id);
  }

  @Put(':id')
  async updateMatch(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() updateMatchDto: UpdateMatchDto,
  ) {
    return this.matchesService.updateMatch(id, user.id, updateMatchDto);
  }

  @Delete(':id')
  async deleteMatch(@Param('id') id: string, @CurrentUser() user: User) {
    return this.matchesService.deleteMatch(id, user.id);
  }

  @Get(':id/games')
  async getMatchGames(@Param('id') id: string) {
    return this.matchesService.getMatchGames(id);
  }

  @Post(':id/record')
  async recordMatch(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() recordMatchDto: RecordMatchDto,
  ) {
    return this.matchesService.recordMatch(id, user.id, recordMatchDto);
  }

  @Get(':id/record')
  async getMatchRecord(@Param('id') id: string) {
    return this.matchesService.getMatchRecord(id);
  }
}

