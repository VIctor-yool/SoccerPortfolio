import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Match } from './match.entity';
import { MatchRecord } from './match-record.entity';
import { Substitution } from './substitution.entity';

export enum GameResult {
  WIN = 'win',
  DRAW = 'draw',
  LOSS = 'loss',
}

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  matchId: string;

  @ManyToOne(() => Match, (match) => match.games, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'matchId' })
  match: Match;

  @Column()
  gameNumber: number;

  @Column()
  ourScore: number;

  @Column()
  opponentScore: number;

  @Column({
    type: 'enum',
    enum: GameResult,
  })
  result: GameResult;

  @OneToMany(() => MatchRecord, (record) => record.game, { cascade: true })
  records: MatchRecord[];

  @OneToMany(() => Substitution, (substitution) => substitution.game, {
    cascade: true,
  })
  substitutions: Substitution[];
}

