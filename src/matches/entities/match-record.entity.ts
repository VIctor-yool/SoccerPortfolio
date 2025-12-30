import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Match } from './match.entity';
import { Game } from './game.entity';
import { User } from '../../users/entities/user.entity';

export enum GoalType {
  FIELD = 'field',
  FREE_KICK = 'free_kick',
  PENALTY = 'penalty',
  OWN_GOAL = 'own_goal',
}

@Entity('match_records')
export class MatchRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  matchId: string;

  @ManyToOne(() => Match, (match) => match.records, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'matchId' })
  match: Match;

  @Column('uuid', { nullable: true })
  gameId?: string;

  @ManyToOne(() => Game, (game) => game.records, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  game?: Game;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ default: false })
  played: boolean;

  @Column({ default: 0 })
  goals: number;

  @Column({ default: 0 })
  assists: number;

  @Column({
    type: 'enum',
    enum: GoalType,
    nullable: true,
  })
  goalType?: GoalType;

  @Column({ nullable: true })
  goalTime?: number;
}

