import { DataSource } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import { Team } from '../src/teams/entities/team.entity';
import { Match } from '../src/matches/entities/match.entity';

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
  entities: [User, Team, Match],
  synchronize: false,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function deleteDummyData() {
  await dataSource.initialize();
  console.log('데이터베이스 연결 완료');

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // teamFC 팀 찾기
    const team = await queryRunner.manager.findOne(Team, {
      where: { name: 'teamFC' },
    });

    if (!team) {
      console.log('teamFC 팀을 찾을 수 없습니다.');
      await queryRunner.rollbackTransaction();
      return;
    }

    console.log(`teamFC 팀 발견 (ID: ${team.id})`);

    // 1. 관련 경기 삭제 (CASCADE로 자동 삭제됨)
    const matches = await queryRunner.manager.find(Match, {
      where: { teamId: team.id },
    });
    console.log(`${matches.length}개의 경기 삭제 중...`);

    // 2. 팀 삭제 (CASCADE로 팀원도 자동 삭제됨)
    await queryRunner.manager.remove(team);
    console.log('teamFC 팀 삭제 완료');

    // 3. 더미 사용자 삭제 (teamFC 관련 이메일)
    const dummyUsers = await queryRunner.manager
      .createQueryBuilder(User, 'user')
      .where("user.email LIKE '%@teamfc.com'")
      .getMany();

    console.log(`${dummyUsers.length}명의 더미 사용자 삭제 중...`);
    await queryRunner.manager.remove(dummyUsers);
    console.log('더미 사용자 삭제 완료');

    await queryRunner.commitTransaction();
    console.log('✅ 더미 데이터 삭제 완료!');
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('❌ 에러 발생:', error);
    throw error;
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

deleteDummyData()
  .then(() => {
    console.log('스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('스크립트 실행 실패:', error);
    process.exit(1);
  });

