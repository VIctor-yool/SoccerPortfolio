import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TeamsModule } from './teams/teams.module';
import { MatchesModule } from './matches/matches.module';
import { StatisticsModule } from './statistics/statistics.module';
import { RankingsModule } from './rankings/rankings.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AttendanceModule } from './attendance/attendance.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
        const isProduction = nodeEnv === 'production';
        
        // DATABASE_URL이 있으면 파싱, 없으면 개별 변수 사용
        const databaseUrl = configService.get<string>('DATABASE_URL');
        
        let dbConfig: {
          host: string;
          port: number;
          username: string;
          password: string;
          database: string;
        };

        if (databaseUrl) {
          // DATABASE_URL 파싱: postgresql://username:password@host:port/database
          const url = new URL(databaseUrl);
          dbConfig = {
            host: url.hostname,
            port: parseInt(url.port) || 5432,
            username: url.username,
            password: url.password,
            database: url.pathname.slice(1), // 첫 번째 '/' 제거
          };
        } else {
          // 개별 환경 변수 사용
          dbConfig = {
            host: configService.get<string>('DB_HOST') || 'localhost',
            port: configService.get<number>('DB_PORT') || 5432,
            username: configService.get<string>('DB_USERNAME') || 'postgres',
            password: configService.get<string>('DB_PASSWORD') || '',
            database: configService.get<string>('DB_DATABASE') || 'soccer_db',
          };
        }

        // Render PostgreSQL은 SSL 연결이 필요함
        const isRenderDB = dbConfig.host.includes('render.com') || 
                          dbConfig.host.includes('.oregon-postgres.render.com') || 
                          dbConfig.host.includes('.singapore-postgres.render.com') || 
                          dbConfig.host.includes('.frankfurt-postgres.render.com');
        
        return {
          type: 'postgres',
          host: dbConfig.host,
          port: dbConfig.port,
          username: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: !isProduction,
          logging: !isProduction,
          // Render PostgreSQL SSL 설정
          ssl: isRenderDB ? {
            rejectUnauthorized: false,
          } : false,
          extra: isRenderDB ? {
            ssl: {
              rejectUnauthorized: false,
            },
          } : {},
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    TeamsModule,
    MatchesModule,
    StatisticsModule,
    RankingsModule,
    DashboardModule,
    AttendanceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
