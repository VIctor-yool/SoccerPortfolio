import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { TeamMember } from './team-member.entity';
import { TeamInvite } from './team-invite.entity';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  region?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column('uuid')
  captainId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'captainId' })
  captain: User;

  @Column({ nullable: true })
  logo?: string;

  @OneToMany(() => TeamMember, (member) => member.team, { cascade: true })
  members: TeamMember[];

  @OneToMany(() => TeamInvite, (invite) => invite.team, { cascade: true })
  invites: TeamInvite[];

  @CreateDateColumn()
  createdAt: Date;
}

