import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Team } from '../../teams/entities/team.entity';
import { Game } from './game.entity';
import { MatchAttendance } from './match-attendance.entity';
import { MatchRecord } from './match-record.entity';

export enum MatchStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
  CANCELLED = 'cancelled',
}

@Entity('matches')
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  teamId: string;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teamId' })
  team: Team;

  @Column()
  opponentTeamName: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ nullable: true })
  time?: string;

  @Column({ nullable: true })
  location?: string;

  @Column({
    type: 'enum',
    enum: MatchStatus,
    default: MatchStatus.SCHEDULED,
  })
  status: MatchStatus;

  @Column({ nullable: true })
  totalOurScore?: number;

  @Column({ nullable: true })
  totalOpponentScore?: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => Game, (game) => game.match, { cascade: true })
  games: Game[];

  @OneToMany(() => MatchAttendance, (attendance) => attendance.match, {
    cascade: true,
  })
  attendances: MatchAttendance[];

  @OneToMany(() => MatchRecord, (record) => record.match, { cascade: true })
  records: MatchRecord[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

