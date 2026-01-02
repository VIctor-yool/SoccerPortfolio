import { DataSource } from 'typeorm';
import { User, Provider } from '../src/users/entities/user.entity';
import { UserPosition, Position } from '../src/users/entities/user-position.entity';
import { Team } from '../src/teams/entities/team.entity';
import { TeamMember, TeamMemberRole, TeamMemberStatus } from '../src/teams/entities/team-member.entity';
import { Match, MatchStatus } from '../src/matches/entities/match.entity';
import { Game, GameResult } from '../src/matches/entities/game.entity';
import { MatchRecord } from '../src/matches/entities/match-record.entity';
import { MatchAttendance, AttendanceStatus } from '../src/matches/entities/match-attendance.entity';
import * as bcrypt from 'bcrypt';

// DATABASE_URL 파싱 함수
function parseDatabaseUrl(url?: string) {
  if (!url) return null;
  
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) return null;
  
  return {
    host: match[3],
    port: parseInt(match[4]),
    username: match[1],
    password: match[2],
    database: match[5],
  };
}

// 데이터베이스 연결 설정
const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL) || {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || process.env.DB_DATABASE || 'soccer',
};

const dataSource = new DataSource({
  type: 'postgres',
  ...dbConfig,
  entities: [
    User,
    UserPosition,
    Team,
    TeamMember,
    Match,
    Game,
    MatchRecord,
    MatchAttendance,
  ],
  synchronize: false,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

const names = [
  '김민수', '이영희', '박준호', '최지은', '정대현',
  '강수진', '윤성호', '임동욱', '한소영', '조민재',
  '오태현', '신혜진', '류진우', '배수빈', '전혜원',
  '송재현', '유지은', '홍길동', '서민석', '김철수',
];

async function generateDummyData() {
  await dataSource.initialize();
  console.log('데이터베이스 연결 완료');

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // 1. 팀장(첫 번째 사용자) 생성
    const hashedPassword = await bcrypt.hash('password123', 10);
    const captain = queryRunner.manager.create(User, {
      email: 'captain@teamfc.com',
      password: hashedPassword,
      name: '팀장',
      provider: Provider.EMAIL,
      birthdate: new Date('1990-01-01'),
      phone: '010-0000-0001',
    });
    const savedCaptain = await queryRunner.manager.save(captain);

    // 2. 팀 생성
    const team = queryRunner.manager.create(Team, {
      name: 'teamFC',
      captainId: savedCaptain.id,
    });
    const savedTeam = await queryRunner.manager.save(team);

    // 3. 팀장을 팀원으로 추가
    const captainMember = queryRunner.manager.create(TeamMember, {
      teamId: savedTeam.id,
      userId: savedCaptain.id,
      role: TeamMemberRole.CAPTAIN,
      status: TeamMemberStatus.ACTIVE,
      jerseyNumber: 1,
    });
    await queryRunner.manager.save(captainMember);

    // 4. 19명의 사용자 생성 및 팀원 추가
    const users: User[] = [savedCaptain];
    const members: TeamMember[] = [captainMember];

    for (let i = 0; i < 19; i++) {
      const user = queryRunner.manager.create(User, {
        email: `user${i + 1}@teamfc.com`,
        password: hashedPassword,
        name: names[i],
        provider: Provider.EMAIL,
        birthdate: new Date(1990 + (i % 10), (i % 12), (i % 28) + 1),
        phone: `010-${String(i + 1).padStart(4, '0')}-${String(i + 2).padStart(4, '0')}`,
      });
      const savedUser = await queryRunner.manager.save(user);
      users.push(savedUser);

      // 포지션 추가 (랜덤)
      const positions = [Position.GK, Position.DF, Position.MF, Position.FW];
      const userPositions = positions.slice(0, Math.floor(Math.random() * 2) + 1);
      for (const pos of userPositions) {
        const position = queryRunner.manager.create(UserPosition, {
          userId: savedUser.id,
          position: pos,
        });
        await queryRunner.manager.save(position);
      }

      // 팀원으로 추가
      const member = queryRunner.manager.create(TeamMember, {
        teamId: savedTeam.id,
        userId: savedUser.id,
        role: TeamMemberRole.MEMBER,
        status: TeamMemberStatus.ACTIVE,
        jerseyNumber: i + 2,
      });
      const savedMember = await queryRunner.manager.save(member);
      members.push(savedMember);
    }

    console.log(`${users.length}명의 사용자 생성 완료`);

    // 5. 경기 생성 (12개 경기)
    const matches: Match[] = [];
    const opponents = ['FC서울', '수원삼성', '전북현대', '울산현대', '포항스틸러스', 
                      '인천유나이티드', '대구FC', '강원FC', '제주유나이티드', '성남FC',
                      '부산아이파크', '광주FC'];

    for (let i = 0; i < 12; i++) {
      const matchDate = new Date();
      matchDate.setMonth(matchDate.getMonth() - (11 - i));
      matchDate.setDate(15 + (i % 15));

      const match = queryRunner.manager.create(Match, {
        teamId: savedTeam.id,
        opponentTeamName: opponents[i],
        date: matchDate,
        time: '10:00',
        location: '축구장',
        status: MatchStatus.FINISHED,
        totalOurScore: Math.floor(Math.random() * 5) + 1,
        totalOpponentScore: Math.floor(Math.random() * 4),
      });
      const savedMatch = await queryRunner.manager.save(match);
      matches.push(savedMatch);

      // 6. 각 경기마다 게임 생성 (1-3개)
      const gameCount = Math.floor(Math.random() * 3) + 1;
      const games: Game[] = [];

      for (let g = 0; g < gameCount; g++) {
        const ourScore = Math.floor(Math.random() * 4) + 1;
        const oppScore = Math.floor(Math.random() * 3);
        let result: GameResult;
        if (ourScore > oppScore) result = GameResult.WIN;
        else if (ourScore === oppScore) result = GameResult.DRAW;
        else result = GameResult.LOSS;

        const game = queryRunner.manager.create(Game, {
          matchId: savedMatch.id,
          gameNumber: g + 1,
          ourScore,
          opponentScore: oppScore,
          result,
        });
        const savedGame = await queryRunner.manager.save(game);
        games.push(savedGame);
      }

      // 7. 참석 기록 생성 (10-18명 참석)
      const attendanceCount = Math.floor(Math.random() * 9) + 10;
      const shuffledUsers = [...users].sort(() => Math.random() - 0.5);
      
      for (let a = 0; a < attendanceCount; a++) {
        const statuses = [
          AttendanceStatus.ATTENDING,
          AttendanceStatus.ATTENDING,
          AttendanceStatus.ATTENDING,
          AttendanceStatus.LATE,
          AttendanceStatus.NOT_ATTENDING,
        ];
        const status = statuses[Math.floor(Math.random() * statuses.length)];

        const attendance = queryRunner.manager.create(MatchAttendance, {
          matchId: savedMatch.id,
          userId: shuffledUsers[a].id,
          status,
        });
        await queryRunner.manager.save(attendance);
      }

      // 8. 경기 기록 생성 (출전, 득점, 도움)
      // 참석한 선수들 중 일부만 출전
      const playingCount = Math.floor(attendanceCount * 0.7);
      const playingUsers = shuffledUsers.slice(0, playingCount);

      for (const game of games) {
        for (const user of playingUsers) {
          const played = Math.random() > 0.2; // 80% 확률로 출전
          if (!played) continue;

          const goals = Math.random() > 0.7 ? Math.floor(Math.random() * 3) : 0;
          const assists = Math.random() > 0.8 ? Math.floor(Math.random() * 2) : 0;

          const record = queryRunner.manager.create(MatchRecord, {
            matchId: savedMatch.id,
            gameId: game.id,
            userId: user.id,
            played: true,
            goals,
            assists,
          });
          await queryRunner.manager.save(record);
        }
      }
    }

    console.log(`${matches.length}개의 경기 생성 완료`);

    await queryRunner.commitTransaction();
    console.log('✅ 더미 데이터 생성 완료!');
    console.log(`팀 ID: ${savedTeam.id}`);
    console.log(`팀장 이메일: captain@teamfc.com`);
    console.log(`팀장 비밀번호: password123`);
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('❌ 에러 발생:', error);
    throw error;
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

generateDummyData()
  .then(() => {
    console.log('스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('스크립트 실행 실패:', error);
    process.exit(1);
  });

