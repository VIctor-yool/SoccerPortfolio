import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserPosition } from './user-position.entity';

export enum Provider {
  GOOGLE = 'google',
  KAKAO = 'kakao',
  EMAIL = 'email',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  password?: string;

  @Column()
  name: string;

  @Column({ type: 'date', nullable: true })
  birthdate?: Date;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  profileImage?: string;

  @Column({
    type: 'enum',
    enum: Provider,
    default: Provider.EMAIL,
  })
  provider: Provider;

  @Column({ nullable: true })
  providerId?: string;

  @Column({ type: 'text', nullable: true })
  summary?: string;

  @Column({ nullable: true })
  refreshToken?: string;

  @OneToMany(() => UserPosition, (position) => position.user, {
    cascade: true,
  })
  positions: UserPosition[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

