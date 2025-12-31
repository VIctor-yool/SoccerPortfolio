import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { User } from './entities/user.entity';
import { UserPosition, Position } from './entities/user-position.entity';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserPosition)
    private userPositionRepository: Repository<UserPosition>,
    private dataSource: DataSource,
    @Inject('SUPABASE_CLIENT')
    private supabase: SupabaseClient,
  ) {}

  async createProfile(userId: string, createProfileDto: CreateProfileDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager
        .getRepository(User)
        .findOne({
          where: { id: userId },
        });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // 기존 포지션 삭제 (항상 삭제 - 빈 배열이어도 처리)
      await queryRunner.manager.delete(UserPosition, {
        userId: user.id,
      });

      // 프로필 정보 업데이트
      user.name = createProfileDto.name;
      if (createProfileDto.birthdate) {
        user.birthdate = new Date(createProfileDto.birthdate);
      }
      user.phone = createProfileDto.phone;
      user.summary = createProfileDto.summary;

      // 새 포지션 추가 (빈 배열이면 추가하지 않음, 중복 제거)
      if (createProfileDto.positions && createProfileDto.positions.length > 0) {
        // 중복 제거
        const uniquePositions = [...new Set(createProfileDto.positions)];
        const positions = uniquePositions.map((position) =>
          queryRunner.manager.create(UserPosition, {
            userId: user.id,
            position,
          }),
        );

        await queryRunner.manager.save(UserPosition, positions);
      }

      // positions 관계를 로드하지 않았으므로 TypeORM이 관계를 추적하지 않음
      await queryRunner.manager.save(User, user);
      await queryRunner.commitTransaction();

      return this.getProfile(userId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager
        .getRepository(User)
        .findOne({
          where: { id: userId },
        });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // 프로필 정보 업데이트
      if (updateProfileDto.name !== undefined) {
        user.name = updateProfileDto.name;
      }
      if (updateProfileDto.birthdate !== undefined) {
        user.birthdate = new Date(updateProfileDto.birthdate);
      }
      if (updateProfileDto.phone !== undefined) {
        user.phone = updateProfileDto.phone;
      }
      if (updateProfileDto.summary !== undefined) {
        user.summary = updateProfileDto.summary;
      }

      // 포지션 업데이트
      if (updateProfileDto.positions !== undefined) {
        // 기존 포지션 삭제 (항상 삭제 - 빈 배열이어도 처리)
        await queryRunner.manager.delete(UserPosition, {
          userId: user.id,
        });

        // 새 포지션이 있으면 추가 (빈 배열이면 모든 포지션 삭제만 수행, 중복 제거)
        if (updateProfileDto.positions.length > 0) {
          // 중복 제거
          const uniquePositions = [...new Set(updateProfileDto.positions)];
          const positions = uniquePositions.map((position) =>
            queryRunner.manager.create(UserPosition, {
              userId: user.id,
              position,
            }),
          );

          await queryRunner.manager.save(UserPosition, positions);
        }
      }

      // positions 관계를 로드하지 않았으므로 TypeORM이 관계를 추적하지 않음
      await queryRunner.manager.save(User, user);
      await queryRunner.commitTransaction();

      return this.getProfile(userId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['positions'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      birthdate: user.birthdate,
      phone: user.phone,
      profileImage: user.profileImage,
      summary: user.summary,
      positions: user.positions?.map((p) => p.position) || [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async deleteUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 사용자 삭제 (CASCADE로 관련 데이터도 자동 삭제됨)
    await this.userRepository.remove(user);

    return { success: true, message: 'User deleted successfully' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 소셜 로그인 사용자는 비밀번호가 없음
    if (!user.password) {
      throw new BadRequestException(
        'Password change is not available for social login users',
      );
    }

    // 현재 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // 새 비밀번호가 현재 비밀번호와 같은지 확인
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    // 새 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    await this.userRepository.save(user);

    return { success: true, message: 'Password changed successfully' };
  }

  async uploadProfileImage(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // 파일 확장자 검증
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WebP images are allowed',
      );
    }

    // 파일 크기 검증 (5MB 제한)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size must be less than 5MB');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 기존 프로필 사진이 있으면 삭제
    if (user.profileImage) {
      try {
        const oldUrl = new URL(user.profileImage);
        const pathParts = oldUrl.pathname.split('/');
        const fileName = pathParts[pathParts.length - 1];
        const filePath = `${userId}/${fileName}`;

        await this.supabase.storage
          .from('profile-images')
          .remove([filePath]);
      } catch (error) {
        // 기존 파일 삭제 실패는 무시 (이미 삭제되었을 수 있음)
        console.warn('Failed to delete old profile image:', error);
      }
    }

    // 새 파일명 생성
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const filePath = `${userId}/${fileName}`;

    // Supabase Storage에 업로드
    const { data, error } = await this.supabase.storage
      .from('profile-images')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw new BadRequestException(`Failed to upload image: ${error.message}`);
    }

    // Public URL 생성
    const { data: urlData } = this.supabase.storage
      .from('profile-images')
      .getPublicUrl(filePath);

    // DB에 URL 저장
    user.profileImage = urlData.publicUrl;
    await this.userRepository.save(user);

    return {
      imageUrl: urlData.publicUrl,
    };
  }
}

