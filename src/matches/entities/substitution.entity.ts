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

@Entity('substitutions')
export class Substitution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  matchId: string;

  @ManyToOne(() => Match, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'matchId' })
  match: Match;

  @Column('uuid', { nullable: true })
  gameId?: string;

  @ManyToOne(() => Game, (game) => game.substitutions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'gameId' })
  game?: Game;

  @Column('uuid')
  playerInId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'playerInId' })
  playerIn: User;

  @Column('uuid')
  playerOutId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'playerOutId' })
  playerOut: User;

  @Column()
  substitutionTime: number;
}

